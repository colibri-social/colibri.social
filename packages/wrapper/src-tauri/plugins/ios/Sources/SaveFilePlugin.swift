import Photos
import SwiftRs
import Tauri
import UIKit

struct SaveFileArgs: Decodable {
  let path: String
  let name: String
  let type: String
}

class SaveFilePlugin: Plugin, UIDocumentPickerDelegate {
  private var pendingExport: Invoke?
  private var pendingName = ""

  @objc public func saveFile(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SaveFileArgs.self)
    let file = URL(fileURLWithPath: args.path)
    let mime = args.type.lowercased()

    if mime.hasPrefix("image/") || mime.hasPrefix("video/") {
      saveToPhotos(
        invoke, file: file, name: args.name, isVideo: mime.hasPrefix("video/"))
      return
    }

    export(invoke, file: file, name: args.name)
  }

  private func saveToPhotos(_ invoke: Invoke, file: URL, name: String, isVideo: Bool) {
    PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
      guard status == .authorized || status == .limited else {
        invoke.reject("photo library access was denied", code: "PermissionDenied")
        return
      }

      PHPhotoLibrary.shared().performChanges({
        let options = PHAssetResourceCreationOptions()
        options.originalFilename = name
        PHAssetCreationRequest.forAsset().addResource(
          with: isVideo ? .video : .photo, fileURL: file, options: options)
      }) { success, _ in
        if success {
          invoke.resolve(["name": name, "destination": "photos"])
          return
        }

        self.export(invoke, file: file, name: name)
      }
    }
  }

  private func export(_ invoke: Invoke, file: URL, name: String) {
    DispatchQueue.main.async {
      guard self.pendingExport == nil else {
        invoke.reject("another download is waiting for a destination", code: "Busy")
        return
      }

      guard let presenter = self.topViewController() else {
        invoke.reject("the app window is not ready")
        return
      }

      let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
      picker.delegate = self
      picker.modalPresentationStyle = .formSheet
      self.pendingExport = invoke
      self.pendingName = name
      presenter.present(picker, animated: true)
    }
  }

  private func topViewController() -> UIViewController? {
    var current = manager.viewController

    while let presented = current?.presentedViewController {
      current = presented
    }

    return current
  }

  private func finishExport() -> Invoke? {
    let invoke = pendingExport
    pendingExport = nil
    return invoke
  }

  func documentPicker(
    _ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]
  ) {
    let name = urls.first?.lastPathComponent ?? pendingName
    finishExport()?.resolve(["name": name])
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finishExport()?.reject("the save was cancelled", code: "Cancelled")
  }
}

@_cdecl("init_plugin_save_file")
func initSaveFilePlugin() -> Plugin {
  return SaveFilePlugin()
}
