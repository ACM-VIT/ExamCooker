import UIKit
import Capacitor

@objc(NativeDownloads)
public final class NativeDownloads: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeDownloads"
    public let jsName = "NativeDownloads"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "shareFile", returnType: CAPPluginReturnPromise)
    ]

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let fileName = call.getString("fileName"), !fileName.isEmpty else {
            call.reject("fileName is required")
            return
        }
        guard let base64Data = call.getString("base64Data"),
              let data = Data(base64Encoded: base64Data) else {
            call.reject("base64Data is invalid")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let presentingViewController = self.bridge?.viewController else {
                call.reject("Bridge view controller is unavailable")
                return
            }

            do {
                let fileUrl = try Self.writeTemporaryFile(data: data, fileName: fileName)
                let activityViewController = UIActivityViewController(
                    activityItems: [fileUrl],
                    applicationActivities: nil
                )
                activityViewController.completionWithItemsHandler = { _, _, _, _ in
                    try? FileManager.default.removeItem(at: fileUrl)
                }

                if let popover = activityViewController.popoverPresentationController {
                    popover.sourceView = presentingViewController.view
                    popover.sourceRect = CGRect(
                        x: presentingViewController.view.bounds.midX,
                        y: presentingViewController.view.bounds.midY,
                        width: 1,
                        height: 1
                    )
                    popover.permittedArrowDirections = []
                }

                presentingViewController.present(activityViewController, animated: true) {
                    call.resolve()
                }
            } catch {
                call.reject("Failed to prepare file for sharing", nil, error)
            }
        }
    }

    private static func writeTemporaryFile(data: Data, fileName: String) throws -> URL {
        let safeFileName = fileName
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("ExamCookerDownloads", isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )

        let fileUrl = directory.appendingPathComponent(
            safeFileName.isEmpty ? "ExamCooker.pdf" : safeFileName
        )
        try data.write(to: fileUrl, options: [.atomic])
        return fileUrl
    }
}
