import Intents
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
	private var contentHandler: ((UNNotificationContent) -> Void)?
	private var original: UNNotificationContent?
	private var tasks: [URLSessionTask] = []

	override func didReceive(
		_ request: UNNotificationRequest,
		withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
	) {
		self.contentHandler = contentHandler
		let content = withSubtitle(request.content)
		original = content

		let senderName = content.userInfo["authorName"] as? String

		let avatarURL = (content.userInfo["authorAvatarUrl"] as? String).flatMap(URL.init(string:))
		let imageURL = (content.userInfo["imageUrl"] as? String).flatMap(URL.init(string:))
		let group = DispatchGroup()
		var avatar: INImage?
		var image: UNNotificationAttachment?

		if let avatarURL {
			group.enter()
			let avatarTask = URLSession.shared.dataTask(with: avatarURL) { data, response, _ in
				if Self.succeeded(response), let data {
					avatar = INImage(imageData: data)
				}
				group.leave()
			}
			tasks.append(avatarTask)
		}

		if let imageURL {
			group.enter()
			let imageTask = URLSession.shared.downloadTask(with: imageURL) { location, response, _ in
				if Self.succeeded(response), let location {
					image = Self.attachment(from: location, response: response)
				}
				group.leave()
			}
			tasks.append(imageTask)
		}

		tasks.forEach { $0.resume() }
		group.notify(queue: .main) { [weak self] in
			guard let self else { return }
			let updated = senderName.map { self.communicationContent(content, senderName: $0, avatar: avatar) } ?? content
			self.deliver(Self.withAttachment(updated, image))
		}
	}

	private static let maxImageBytes: Int64 = 10 * 1024 * 1024

	private static func succeeded(_ response: URLResponse?) -> Bool {
		(response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
	}

	private static func attachment(from location: URL, response: URLResponse?) -> UNNotificationAttachment? {
		let size = (try? location.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(Int64.init) ?? 0
		guard size > 0, size <= maxImageBytes else { return nil }
		let ext: String
		switch response?.mimeType?.lowercased() {
		case "image/png": ext = "png"
		case "image/gif": ext = "gif"
		case "image/heic": ext = "heic"
		case "image/webp": ext = "webp"
		default: ext = "jpg"
		}
		let destination = FileManager.default.temporaryDirectory
			.appendingPathComponent(UUID().uuidString)
			.appendingPathExtension(ext)
		do {
			try FileManager.default.moveItem(at: location, to: destination)
			return try UNNotificationAttachment(identifier: "image", url: destination, options: nil)
		} catch {
			return nil
		}
	}

	private static func withAttachment(
		_ content: UNNotificationContent,
		_ image: UNNotificationAttachment?
	) -> UNNotificationContent {
		guard let image, let mutable = content.mutableCopy() as? UNMutableNotificationContent else {
			return content
		}
		mutable.attachments = [image]
		return mutable
	}

	override func serviceExtensionTimeWillExpire() {
		tasks.forEach { $0.cancel() }
		if let original {
			deliver(original)
		}
	}

	private func deliver(_ content: UNNotificationContent) {
		guard let handler = contentHandler else { return }
		contentHandler = nil
		handler(content)
	}

	private func withSubtitle(_ content: UNNotificationContent) -> UNNotificationContent {
		guard content.subtitle.isEmpty else { return content }
		let info = content.userInfo
		let subtitle = [info["subtitle"], info["spaceName"], info["communityName"]]
			.compactMap { $0 as? String }
			.first { !$0.isEmpty }
		guard let subtitle, let mutable = content.mutableCopy() as? UNMutableNotificationContent else {
			return content
		}
		mutable.subtitle = subtitle
		return mutable
	}

	private func communicationContent(
		_ content: UNNotificationContent,
		senderName: String,
		avatar: INImage?
	) -> UNNotificationContent {
		let info = content.userInfo
		let senderId = (info["messageAuthor"] as? String) ?? senderName
		let conversation = (info["threadUri"] as? String) ?? (info["channelUri"] as? String) ?? (info["channel"] as? String) ?? content.threadIdentifier

		let sender = INPerson(
			personHandle: INPersonHandle(value: senderId, type: .unknown),
			nameComponents: nil,
			displayName: senderName,
			image: avatar,
			contactIdentifier: nil,
			customIdentifier: senderId
		)

		let groupName = content.subtitle.isEmpty ? nil : INSpeakableString(spokenPhrase: content.subtitle)
		let recipients = groupName.map { _ in
			[
				sender,
				INPerson(
					personHandle: INPersonHandle(value: conversation, type: .unknown),
					nameComponents: nil,
					displayName: nil,
					image: nil,
					contactIdentifier: nil,
					customIdentifier: conversation
				),
			]
		}

		let intent = INSendMessageIntent(
			recipients: recipients,
			outgoingMessageType: .outgoingMessageText,
			content: content.body,
			speakableGroupName: groupName,
			conversationIdentifier: conversation,
			serviceName: nil,
			sender: sender,
			attachments: nil
		)
		if let avatar {
			intent.setImage(avatar, forParameterNamed: \.sender)
		}

		let interaction = INInteraction(intent: intent, response: nil)
		interaction.direction = .incoming
		interaction.donate(completion: nil)

		do {
			return try content.updating(from: intent)
		} catch {
			return content
		}
	}
}
