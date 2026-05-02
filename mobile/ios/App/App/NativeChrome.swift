import Capacitor
import SwiftUI
import UIKit

@objc(NativeChrome)
public final class NativeChrome: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeChrome"
    public let jsName = "NativeChrome"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setLogoVisible", returnType: CAPPluginReturnPromise)
    ]

    private var logoHost: UIHostingController<AnyView>?
    private var logoTapRecognizer: UITapGestureRecognizer?

    @objc func setLogoVisible(_ call: CAPPluginCall) {
        let visible = call.getBool("visible") ?? false
        let darkMode = call.getBool("darkMode") ?? true

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.setLogoVisible(visible, darkMode: darkMode)
            call.resolve()
        }
    }

    private func setLogoVisible(_ visible: Bool, darkMode: Bool) {
        if visible {
            installLogoHostIfNeeded()
            logoHost?.rootView = AnyView(NativeChromeLogo(darkMode: darkMode))
            logoHost?.view.isHidden = false
            UIView.animate(withDuration: 0.18) {
                self.logoHost?.view.alpha = 1
            }
        } else {
            UIView.animate(withDuration: 0.16) {
                self.logoHost?.view.alpha = 0
            } completion: { [weak self] _ in
                self?.logoHost?.view.isHidden = true
            }
        }
    }

    private func installLogoHostIfNeeded() {
        guard logoHost == nil else { return }
        guard let containerView = bridge?.viewController?.view else { return }

        let host = UIHostingController(rootView: AnyView(NativeChromeLogo(darkMode: true)))
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        host.view.isOpaque = false
        host.view.alpha = 0
        host.view.isHidden = true
        host.view.isUserInteractionEnabled = true

        let tapRecognizer = UITapGestureRecognizer(target: self, action: #selector(logoTapped))
        host.view.addGestureRecognizer(tapRecognizer)

        containerView.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: containerView.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            host.view.topAnchor.constraint(equalTo: containerView.safeAreaLayoutGuide.topAnchor, constant: 6),
            host.view.widthAnchor.constraint(equalToConstant: 178),
            host.view.heightAnchor.constraint(equalToConstant: 44),
        ])

        logoHost = host
        logoTapRecognizer = tapRecognizer
    }

    @objc private func logoTapped() {
        bridge?.webView?.evaluateJavaScript("window.location.assign('/')")
    }
}

private struct NativeChromeLogo: View {
    let darkMode: Bool

    @ViewBuilder
    var body: some View {
        if #available(iOS 26.0, *) {
            #if compiler(>=6.2)
            NativeChromeLiquidGlassLogo(darkMode: darkMode)
            #else
            NativeChromeFallbackLogo(darkMode: darkMode)
            #endif
        } else {
            NativeChromeFallbackLogo(darkMode: darkMode)
        }
    }
}

#if compiler(>=6.2)
@available(iOS 26.0, *)
private struct NativeChromeLiquidGlassLogo: View {
    let darkMode: Bool

    var body: some View {
        GlassEffectContainer(spacing: 0) {
            NativeChromeLogoContent(darkMode: darkMode)
                .padding(.horizontal, 14)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .glassEffect(
                    .regular
                        .tint(darkMode ? Color.white.opacity(0.05) : Color.white.opacity(0.34))
                        .interactive(),
                    in: .rect(cornerRadius: 19)
                )
        }
        .frame(width: 178, height: 44)
        .contentShape(.rect(cornerRadius: 19))
    }
}
#endif

private struct NativeChromeFallbackLogo: View {
    let darkMode: Bool

    var body: some View {
        NativeChromeLogoContent(darkMode: darkMode)
            .padding(.horizontal, 14)
            .frame(width: 178, height: 44)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 19, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 19, style: .continuous)
                    .stroke(.white.opacity(darkMode ? 0.16 : 0.44), lineWidth: 1)
            }
            .shadow(color: .black.opacity(darkMode ? 0.28 : 0.10), radius: 18, x: 0, y: 10)
            .contentShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
    }
}

private struct NativeChromeLogoContent: View {
    let darkMode: Bool

    var body: some View {
        HStack(spacing: 9) {
            Image("AppIcon")
                .resizable()
                .scaledToFit()
                .frame(width: 22, height: 22)
                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))

            HStack(spacing: 0) {
                Text("Exam")
                    .foregroundStyle(darkMode ? Color(red: 0.84, green: 0.84, blue: 0.84) : .black.opacity(0.86))
                Text("Cooker")
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                Color(red: 0.15, green: 0.24, blue: 0.88),
                                Color(red: 0.15, green: 0.73, blue: 0.93),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
            .font(.system(size: 17, weight: .semibold, design: .rounded))
            .lineLimit(1)
        }
    }
}
