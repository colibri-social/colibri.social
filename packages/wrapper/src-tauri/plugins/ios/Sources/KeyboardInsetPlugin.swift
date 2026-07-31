import SwiftRs
import Tauri
import UIKit
import WebKit

class KeyboardInsetPlugin: Plugin {
  private weak var trackedWebView: WKWebView?
  private weak var trackedScrollView: UIScrollView?
  private var displayLink: CADisplayLink?
  private var animationStart: CFTimeInterval = 0
  private var animationDuration: CFTimeInterval = 0.25
  private var timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
  private var fromInset: CGFloat = 0
  private var toInset: CGFloat = 0
  private var lastDispatchedInset: CGFloat = -1
  private var isResettingScroll = false

  override func load(webview: WKWebView) {
    trackedWebView = webview
    webview.scrollView.isScrollEnabled = false
    webview.scrollView.bounces = false
    trackedScrollView = webview.scrollView
    webview.scrollView.addObserver(
      self, forKeyPath: #keyPath(UIScrollView.contentOffset), options: [.new], context: nil)
    let setupScript = WKUserScript(
      source:
        "window.__colibriKeyboardInset = function(v) { window.dispatchEvent(new CustomEvent('colibri-keyboard-inset', { detail: v })); };",
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    )
    webview.configuration.userContentController.addUserScript(setupScript)
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
      let window = webView.window,
      let userInfo = notification.userInfo,
      let endFrameValue = userInfo[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue,
      let durationValue = userInfo[UIResponder.keyboardAnimationDurationUserInfoKey] as? NSNumber
    else { return }

    let keyboardFrameInWindow = window.convert(endFrameValue.cgRectValue, from: nil)
    let webViewFrameInWindow = webView.convert(webView.bounds, to: window)
    let overlap = min(
      webView.bounds.height,
      max(0, webViewFrameInWindow.maxY - keyboardFrameInWindow.minY)
    )

    if let curveValue = userInfo[UIResponder.keyboardAnimationCurveUserInfoKey] as? NSNumber {
      timingFunction = Self.timingFunction(forCurve: curveValue.uintValue)
    }

    fromInset = toInset
    toInset = overlap
    animationDuration = max(durationValue.doubleValue, 0.05)
    animationStart = CACurrentMediaTime()

    displayLink?.invalidate()
    let link = CADisplayLink(target: self, selector: #selector(tick))
    link.add(to: .main, forMode: .common)
    displayLink = link
  }

  @objc private func tick(_ link: CADisplayLink) {
    let elapsed = CACurrentMediaTime() - animationStart
    let t = min(1, max(0, elapsed / animationDuration))
    let eased = Self.solve(timingFunction, at: t)
    dispatch(fromInset + (toInset - fromInset) * CGFloat(eased))

    if t >= 1 {
      link.invalidate()
      displayLink = nil
      dispatch(toInset)
    }
  }

  private func dispatch(_ value: CGFloat) {
    let rounded = (value * 100).rounded() / 100
    if rounded == lastDispatchedInset { return }
    lastDispatchedInset = rounded
    trackedWebView?.evaluateJavaScript(
      "window.__colibriKeyboardInset && window.__colibriKeyboardInset(\(rounded));",
      completionHandler: nil
    )
  }

  private static func timingFunction(forCurve raw: UInt) -> CAMediaTimingFunction {
    switch raw {
    case 1: return CAMediaTimingFunction(name: .easeIn)
    case 2: return CAMediaTimingFunction(name: .easeOut)
    case 3: return CAMediaTimingFunction(name: .linear)
    default: return CAMediaTimingFunction(name: .easeInEaseOut)
    }
  }

  private static func solve(_ function: CAMediaTimingFunction, at t: Double) -> Double {
    var p1 = [Float](repeating: 0, count: 2)
    var p2 = [Float](repeating: 0, count: 2)
    function.getControlPoint(at: 1, values: &p1)
    function.getControlPoint(at: 2, values: &p2)
    let x1 = Double(p1[0]), y1 = Double(p1[1])
    let x2 = Double(p2[0]), y2 = Double(p2[1])

    func bezier(_ u: Double, _ c1: Double, _ c2: Double) -> Double {
      let mu = 1 - u
      return 3 * mu * mu * u * c1 + 3 * mu * u * u * c2 + u * u * u
    }

    var lower = 0.0
    var upper = 1.0
    var mid = t
    for _ in 0..<20 {
      mid = (lower + upper) / 2
      let x = bezier(mid, x1, x2)
      if abs(x - t) < 0.0001 { break }
      if x < t { lower = mid } else { upper = mid }
    }
    return bezier(mid, y1, y2)
  }
}

@_cdecl("init_plugin_keyboard_inset")
func initPlugin() -> Plugin {
  return KeyboardInsetPlugin()
}
