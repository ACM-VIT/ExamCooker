import UIKit
import Capacitor

private struct NativeCourseSearchRecord {
    let code: String
    let title: String
    let paperCount: Int
    let noteCount: Int
    let aliases: [String]

    var searchableText: String {
        ([code, title] + aliases).joined(separator: " ")
    }
}

private final class NativeCourseSearchViewController: UITableViewController, UISearchResultsUpdating, UISearchBarDelegate {
    private let courses: [NativeCourseSearchRecord]
    private let placeholder: String
    private let initialQuery: String
    private let darkMode: Bool
    private let onSelect: (NativeCourseSearchRecord, Int, Int) -> Void
    private let onSubmit: (String, Int, NativeCourseSearchRecord?) -> Void
    private let onCancel: () -> Void

    private let searchController = UISearchController(searchResultsController: nil)
    private var filteredCourses: [NativeCourseSearchRecord] = []

    init(
        title: String,
        placeholder: String,
        initialQuery: String,
        darkMode: Bool,
        courses: [NativeCourseSearchRecord],
        onSelect: @escaping (NativeCourseSearchRecord, Int, Int) -> Void,
        onSubmit: @escaping (String, Int, NativeCourseSearchRecord?) -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.courses = courses
        self.placeholder = placeholder
        self.initialQuery = initialQuery
        self.darkMode = darkMode
        self.onSelect = onSelect
        self.onSubmit = onSubmit
        self.onCancel = onCancel
        self.filteredCourses = courses
        super.init(style: .insetGrouped)
        self.title = title
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        overrideUserInterfaceStyle = darkMode ? .dark : .light
        view.backgroundColor = .systemBackground
        navigationController?.navigationBar.overrideUserInterfaceStyle = overrideUserInterfaceStyle
        navigationController?.navigationBar.tintColor = .label
        navigationController?.navigationBar.standardAppearance = navigationBarAppearance()
        navigationController?.navigationBar.scrollEdgeAppearance = navigationBarAppearance()

        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "CourseCell")
        tableView.backgroundColor = .systemBackground
        tableView.keyboardDismissMode = .onDrag

        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )

        searchController.searchResultsUpdater = self
        searchController.searchBar.delegate = self
        searchController.obscuresBackgroundDuringPresentation = false
        searchController.searchBar.placeholder = placeholder
        searchController.searchBar.autocapitalizationType = .allCharacters
        searchController.searchBar.returnKeyType = .search
        searchController.searchBar.searchTextField.overrideUserInterfaceStyle = overrideUserInterfaceStyle
        searchController.searchBar.searchTextField.backgroundColor = .secondarySystemBackground
        searchController.searchBar.searchTextField.textColor = .label
        searchController.searchBar.searchTextField.tintColor = .label
        navigationItem.searchController = searchController
        navigationItem.hidesSearchBarWhenScrolling = false
        definesPresentationContext = true

        applyFilter(initialQuery)
        searchController.searchBar.text = initialQuery
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        searchController.isActive = true
        searchController.searchBar.becomeFirstResponder()
    }

    func updateSearchResults(for searchController: UISearchController) {
        applyFilter(searchController.searchBar.text ?? "")
    }

    func searchBarSearchButtonClicked(_ searchBar: UISearchBar) {
        let query = (searchBar.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return }
        let exact = courses.first { $0.code.caseInsensitiveCompare(query.normalizedCourseCode()) == .orderedSame }
        onSubmit(query, filteredCourses.count, exact)
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        filteredCourses.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let course = filteredCourses[indexPath.row]
        let cell = tableView.dequeueReusableCell(withIdentifier: "CourseCell", for: indexPath)
        cell.overrideUserInterfaceStyle = overrideUserInterfaceStyle
        cell.backgroundColor = .secondarySystemGroupedBackground
        var content = cell.defaultContentConfiguration()
        content.text = course.title
        content.secondaryText = courseSummary(course)
        content.textProperties.font = .preferredFont(forTextStyle: .body)
        content.secondaryTextProperties.font = .preferredFont(forTextStyle: .subheadline)
        content.secondaryTextProperties.color = .secondaryLabel
        cell.contentConfiguration = content
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let course = filteredCourses[indexPath.row]
        onSelect(course, filteredCourses.count, indexPath.row)
    }

    @objc private func cancelTapped() {
        onCancel()
    }

    private func applyFilter(_ rawQuery: String) {
        let query = rawQuery.normalizedSearchText()
        let codeQuery = rawQuery.normalizedCourseCode()

        if query.isEmpty {
            filteredCourses = courses
        } else {
            let terms = query.split(separator: " ").map(String.init)
            filteredCourses = courses.filter { course in
                if course.code.uppercased().hasPrefix(codeQuery), codeQuery.count >= 2 {
                    return true
                }
                let haystack = course.searchableText.normalizedSearchText()
                return terms.allSatisfy { haystack.contains($0) }
            }
        }

        if filteredCourses.isEmpty {
            let emptyLabel = UILabel()
            emptyLabel.text = "No courses found"
            emptyLabel.textColor = .secondaryLabel
            emptyLabel.textAlignment = .center
            emptyLabel.font = .preferredFont(forTextStyle: .body)
            tableView.backgroundView = emptyLabel
        } else {
            tableView.backgroundView = nil
        }

        tableView.reloadData()
    }

    private func courseSummary(_ course: NativeCourseSearchRecord) -> String {
        var parts = [course.code.uppercased()]
        if course.paperCount > 0 {
            parts.append("\(course.paperCount) paper\(course.paperCount == 1 ? "" : "s")")
        }
        if course.noteCount > 0 {
            parts.append("\(course.noteCount) note\(course.noteCount == 1 ? "" : "s")")
        }
        return parts.joined(separator: "  |  ")
    }

    private func navigationBarAppearance() -> UINavigationBarAppearance {
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = .systemBackground
        appearance.titleTextAttributes = [.foregroundColor: UIColor.label]
        appearance.largeTitleTextAttributes = [.foregroundColor: UIColor.label]
        return appearance
    }
}

@objc(NativeCourseSearch)
public final class NativeCourseSearch: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeCourseSearch"
    public let jsName = "NativeCourseSearch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise)
    ]

    private var presentedController: UINavigationController?

    @objc func present(_ call: CAPPluginCall) {
        guard presentedController == nil else {
            call.reject("Native course search is already open")
            return
        }

        let title = call.getString("title") ?? "Search"
        let placeholder = call.getString("placeholder") ?? "Search"
        let initialQuery = call.getString("initialQuery") ?? ""
        let darkMode = call.getBool("darkMode") ?? false
        let courseObjects = call.getArray("courses", JSObject.self) ?? []
        let courses = courseObjects.compactMap(Self.courseRecord)

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            guard let presentingViewController = self.bridge?.viewController else {
                call.reject("Bridge view controller is unavailable")
                return
            }

            let viewController = NativeCourseSearchViewController(
                title: title,
                placeholder: placeholder,
                initialQuery: initialQuery,
                darkMode: darkMode,
                courses: courses,
                onSelect: { [weak self] course, resultCount, resultIndex in
                    self?.dismissPresented {
                        call.resolve([
                            "action": "select",
                            "courseCode": course.code,
                            "resultCount": resultCount,
                            "resultIndex": resultIndex
                        ])
                    }
                },
                onSubmit: { [weak self] query, resultCount, exactCourse in
                    self?.dismissPresented {
                        var payload: JSObject = [
                            "action": "submit",
                            "query": query,
                            "resultCount": resultCount
                        ]
                        if let exactCourse {
                            payload["exactCourseCode"] = exactCourse.code
                        }
                        call.resolve(payload)
                    }
                },
                onCancel: { [weak self] in
                    self?.dismissPresented {
                        call.resolve(["action": "cancel"])
                    }
                }
            )

            let navigationController = UINavigationController(rootViewController: viewController)
            navigationController.overrideUserInterfaceStyle = darkMode ? .dark : .light
            if let sheet = navigationController.sheetPresentationController {
                sheet.detents = [.large()]
                sheet.prefersGrabberVisible = true
            }
            navigationController.modalPresentationStyle = .pageSheet
            self.presentedController = navigationController
            presentingViewController.present(navigationController, animated: true)
        }
    }

    private func dismissPresented(completion: @escaping () -> Void) {
        guard let controller = presentedController else {
            completion()
            return
        }
        presentedController = nil
        controller.dismiss(animated: true, completion: completion)
    }

    private static func courseRecord(from object: JSObject) -> NativeCourseSearchRecord? {
        guard let code = object["code"] as? String,
              let title = object["title"] as? String else {
            return nil
        }

        return NativeCourseSearchRecord(
            code: code,
            title: title,
            paperCount: object["paperCount"] as? Int ?? 0,
            noteCount: object["noteCount"] as? Int ?? 0,
            aliases: object["aliases"] as? [String] ?? []
        )
    }
}

private extension String {
    func normalizedSearchText() -> String {
        lowercased()
            .map { $0.isLetter || $0.isNumber ? String($0) : " " }
            .joined()
            .split(separator: " ")
            .joined(separator: " ")
    }

    func normalizedCourseCode() -> String {
        uppercased().filter { $0.isLetter || $0.isNumber }
    }
}
