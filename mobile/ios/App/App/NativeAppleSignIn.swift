import AuthenticationServices
import Capacitor
import UIKit

@objc(NativeAppleSignIn)
public final class NativeAppleSignIn: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAppleSignIn"
    public let jsName = "NativeAppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var activeCall: CAPPluginCall?
    private var activeController: ASAuthorizationController?

    @objc func authorize(_ call: CAPPluginCall) {
        guard activeCall == nil else {
            call.reject("Apple sign-in is already in progress")
            return
        }

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = requestedScopes(from: call)

        activeCall = call

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.activeController = controller
            controller.performRequests()
        }
    }

    private func requestedScopes(from call: CAPPluginCall) -> [ASAuthorization.Scope]? {
        let scopes = call.getString("scopes") ?? "email name"
        var requestedScopes: [ASAuthorization.Scope] = []

        if scopes.contains("email") {
            requestedScopes.append(.email)
        }
        if scopes.contains("name") {
            requestedScopes.append(.fullName)
        }

        return requestedScopes.isEmpty ? nil : requestedScopes
    }

    private func clearActiveRequest() {
        activeCall = nil
        activeController = nil
    }
}

extension NativeAppleSignIn: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let call = activeCall else {
            clearActiveRequest()
            return
        }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            call.reject("Apple sign-in returned an unsupported credential")
            clearActiveRequest()
            return
        }
        guard
            let identityTokenData = credential.identityToken,
            let identityToken = String(data: identityTokenData, encoding: .utf8)
        else {
            call.reject("Apple sign-in did not return an identity token")
            clearActiveRequest()
            return
        }

        let authorizationCode = credential.authorizationCode.flatMap {
            String(data: $0, encoding: .utf8)
        }

        var response: JSObject = [
            "identityToken": identityToken,
            "user": credential.user
        ]
        if let authorizationCode {
            response["authorizationCode"] = authorizationCode
        }
        if let email = credential.email {
            response["email"] = email
        }
        if let familyName = credential.fullName?.familyName {
            response["familyName"] = familyName
        }
        if let givenName = credential.fullName?.givenName {
            response["givenName"] = givenName
        }

        call.resolve(["response": response])
        clearActiveRequest()
    }

    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        guard let call = activeCall else {
            clearActiveRequest()
            return
        }

        call.reject(error.localizedDescription)
        clearActiveRequest()
    }
}

extension NativeAppleSignIn: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = bridge?.viewController?.view.window {
            return window
        }

        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }
}
