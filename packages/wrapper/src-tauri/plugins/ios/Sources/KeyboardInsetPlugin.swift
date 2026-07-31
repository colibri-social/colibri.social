import SwiftRs
import Tauri
import UIKit
import WebKit

class KeyboardInsetPlugin: Plugin {
  private weak var trackedWebView: WKWebView?
  private weak var trackedScrollView: UIScrollView?
  private let probeView = UIView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
  private var lastDispatchedInset: CGFloat = -1
  private var isResettingScroll = false
  private var oneWayLatency: CFTimeInterval = 0.004

  private static let bridgeSource = """
    window.__colibriKeyboardInset = function (inset, duration, mass, stiffness, damping, velocity, latency) {
      window.dispatchEvent(new CustomEvent('colibri-keyboard-inset', {
        detail: {
          inset: inset,
          duration: duration,
          mass: mass,
          stiffness: stiffness,
          damping: damping,
          velocity: velocity,
          latency: latency,
          at: performance.now()
        }
      }));
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

    probeView.layer.removeAllAnimations()
    probeView.frame = CGRect(x: 0, y: overlap, width: 1, height: 1)

    let reported =
      (userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber)?.doubleValue ?? 0.25
    var duration = max(reported, 0.05)
    var mass = 0.0
    var stiffness = 0.0
    var damping = 0.0
    var velocity = 0.0

    if let spring = probeView.layer.animation(forKey: "position") as? CASpringAnimation {
      duration = max(spring.duration, 0.05)
      mass = Double(spring.mass)
      stiffness = Double(spring.stiffness)
      damping = Double(spring.damping)
      velocity = Double(spring.initialVelocity)
    }

    probeView.layer.removeAllAnimations()

    dispatch(
      overlap,
      duration: duration,
      mass: mass,
      stiffness: stiffness,
      damping: damping,
      velocity: velocity
    )
  }

  private func dispatch(
    _ value: CGFloat, duration: Double, mass: Double, stiffness: Double, damping: Double,
    velocity: Double
  ) {
    let rounded = (value * 100).rounded() / 100
    if rounded == lastDispatchedInset { return }
    lastDispatchedInset = rounded

    var script = "window.__colibriKeyboardInset && window.__colibriKeyboardInset("
    script += String(Double(rounded)) + ", "
    script += String(duration * 1000) + ", "
    script += String(mass) + ", "
    script += String(stiffness) + ", "
    script += String(damping) + ", "
    script += String(velocity) + ", "
    script += String(oneWayLatency * 1000) + ");"

    let sentAt = CACurrentMediaTime()
    trackedWebView?.evaluateJavaScript(script) { [weak self] _, _ in
      guard let self = self else { return }
      let sample = max(0.0005, min((CACurrentMediaTime() - sentAt) / 2, 0.05))
      self.oneWayLatency = self.oneWayLatency * 0.7 + sample * 0.3
    }
  }
}

@_cdecl("init_plugin_keyboard_inset")
func initPlugin() -> Plugin {
  return KeyboardInsetPlugin()
}
