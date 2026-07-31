import SwiftRs
import Tauri
import UIKit
import WebKit

class KeyboardInsetPlugin: Plugin {
  private weak var trackedWebView: WKWebView?
  private weak var trackedScrollView: UIScrollView?
  private let probeView = UIView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
  private var displayLink: CADisplayLink?
  private var deadline: CFTimeInterval = 0
  private var lastDispatchedInset: CGFloat = -1
  private var isResettingScroll = false

  private static let bridgeSource = """
    window.__colibriKeyboardInset = function (value, settled) {
      window.dispatchEvent(new CustomEvent('colibri-keyboard-inset', { detail: value }));
      if (settled) window.dispatchEvent(new Event('colibri-keyboard-inset-end'));
    };
    """

  override func load(webview: WKWebView) {
    trackedWebView = webview
    webview.scrollView.isScrollEnabled = false
    webview.scrollView.bounces = false
    trackedScrollView = webview.scrollView
    webview.scrollView.addObserver(
      self, forKeyPath: #keyPath(UIScrollView.contentOffset), options: [.new], context: nil)

    probeView.isUserInteractionEnabled = false
    probeView.backgroundColor = .clear
    webview.superview?.addSubview(probeView)

    webview.configuration.userContentController.addUserScript(
      WKUserScript(
        source: Self.bridgeSource,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
      ))

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleKeyboardFrameChange(_:)),
      name: UIResponder.keyboardWillChangeFrameNotification,
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    trackedScrollView?.removeObserver(self, forKeyPath: #keyPath(UIScrollView.contentOffset))
    displayLink?.invalidate()
  }

  override func observeValue(
    forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey: Any]?,
    context: UnsafeMutableRawPointer?
  ) {
    guard !isResettingScroll,
      keyPath == #keyPath(UIScrollView.contentOffset),
      let scrollView = object as? UIScrollView,
      scrollView.contentOffset != .zero
    else { return }
    isResettingScroll = true
    scrollView.contentOffset = .zero
    isResettingScroll = false
  }

  @objc private func handleKeyboardFrameChange(_ notification: Notification) {
    guard let webView = trackedWebView,
      let superview = webView.superview,
      webView.window != nil,
      let userInfo = notification.userInfo,
      let endFrameValue = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue
    else { return }

    let fullBounds = superview.bounds
    let keyboardFrameInSuperview = superview.convert(endFrameValue.cgRectValue, from: nil)
    let overlap = min(
      fullBounds.height,
      max(0, fullBounds.maxY - keyboardFrameInSuperview.minY)
    )

    if probeView.superview !== superview {
      probeView.removeFromSuperview()
      superview.addSubview(probeView)
    }

    let presented = probeView.layer.presentation()?.frame.origin.y ?? probeView.frame.origin.y
    probeView.layer.removeAllAnimations()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    probeView.frame = CGRect(x: 0, y: presented, width: 1, height: 1)
    CATransaction.commit()
    probeView.frame = CGRect(x: 0, y: overlap, width: 1, height: 1)

    let duration =
      (userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
    deadline = CACurrentMediaTime() + max(duration, 0.05) + 0.35

    if displayLink == nil {
      let link = CADisplayLink(target: self, selector: #selector(tick))
      link.add(to: .main, forMode: .common)
      displayLink = link
    }
  }

  @objc private func tick(_ link: CADisplayLink) {
    let isAnimating =
      probeView.layer.animationKeys()?.isEmpty == false && CACurrentMediaTime() < deadline

    if isAnimating {
      let presented = probeView.layer.presentation()?.frame.origin.y ?? probeView.frame.origin.y
      dispatch(presented, settled: false)
      return
    }

    link.invalidate()
    displayLink = nil
    probeView.layer.removeAllAnimations()
    dispatch(probeView.frame.origin.y, settled: true)
  }

  private func dispatch(_ value: CGFloat, settled: Bool) {
    let rounded = (value * 100).rounded() / 100
    if rounded == lastDispatchedInset && !settled { return }
    lastDispatchedInset = rounded
    trackedWebView?.evaluateJavaScript(
      "window.__colibriKeyboardInset && window.__colibriKeyboardInset(\(rounded), \(settled));",
      completionHandler: nil
    )
  }
}

@_cdecl("init_plugin_keyboard_inset")
func initPlugin() -> Plugin {
  return KeyboardInsetPlugin()
}
