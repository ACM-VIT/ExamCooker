import UIKit
import Capacitor
import WebKit

private let appShellBackgroundColor = UIColor(red: 0.047, green: 0.071, blue: 0.133, alpha: 1)

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var didRegisterLocalPlugins = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        configureWindowBackground()
        DispatchQueue.main.async { [weak self] in
            self?.configureAppShell()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        configureAppShell()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

private extension AppDelegate {
    func configureAppShell() {
        configureWindowBackground()
        configureWebViewChrome()
        registerLocalPluginsIfNeeded()
    }

    func configureWindowBackground() {
        window?.backgroundColor = appShellBackgroundColor
        window?.rootViewController?.view.backgroundColor = appShellBackgroundColor
        window?.rootViewController?.view.superview?.backgroundColor = appShellBackgroundColor
    }

    func configureWebViewChrome() {
        guard let rootView = window?.rootViewController?.view else { return }
        rootView.backgroundColor = appShellBackgroundColor
        for webView in rootView.findSubviews(ofType: WKWebView.self) {
            webView.superview?.backgroundColor = appShellBackgroundColor
            webView.backgroundColor = appShellBackgroundColor
            webView.isOpaque = false
            if #available(iOS 15.0, *) {
                webView.underPageBackgroundColor = appShellBackgroundColor
            }
            webView.scrollView.backgroundColor = appShellBackgroundColor
            webView.scrollView.bounces = false
            webView.scrollView.alwaysBounceVertical = false
            webView.scrollView.alwaysBounceHorizontal = false
        }
    }

    func registerLocalPluginsIfNeeded() {
        guard !didRegisterLocalPlugins else { return }
        guard let bridgeViewController = window?.rootViewController as? CAPBridgeViewController else { return }
        guard let bridge = bridgeViewController.bridge else { return }

        let plugins: [CAPPlugin & CAPBridgedPlugin] = [
            NativeAppleSignIn(),
            NativeDownloads(),
            NativeCourseSearch()
        ]

        for plugin in plugins where bridge.plugin(withName: plugin.jsName) == nil {
            bridge.registerPluginInstance(plugin)
        }

        didRegisterLocalPlugins = true
    }
}

private extension UIView {
    func findSubviews<T: UIView>(ofType type: T.Type) -> [T] {
        var matches = subviews.compactMap { $0 as? T }
        for subview in subviews {
            matches.append(contentsOf: subview.findSubviews(ofType: type))
        }
        return matches
    }
}
