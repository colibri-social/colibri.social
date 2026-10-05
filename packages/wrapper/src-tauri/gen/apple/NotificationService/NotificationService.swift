import Intents
import UserNotifications

final class NotificationService: UNNotificationServiceExtension {
	private var contentHandler: ((UNNotificationContent) -> Void)?
	private var original: UNNotificationContent?
	private var task: URLSessionDataTask?

	override func didReceive(
		_ request: UNNotificationRequest,
		withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
	) {
		self.contentHandler = contentHandler
		original = request.content

		guard let senderName = request.content.userInfo["authorName"] as? String else {
			deliver(request.content)
			return
		}

		let avatarURL = (request.content.userInfo["authorAvatarUrl"] as? String).flatMap(URL.init(string:))
		guard let avatarURL else {
			deliver(communicationContent(request.content, senderName: senderName, avatar: nil))
			return
		}

		task = URLSession.shared.dataTask(with: avatarURL) { [weak self] data, response, _ in
			guard let self else { return }
			let ok = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
			let avatar = ok ? data.map { INImage(imageData: $0) } : nil
			self.deliver(self.communicationContent(request.content, senderName: senderName, avatar: avatar))
		}
		task?.resume()
	}

	override func serviceExtensionTimeWillExpire() {
		task?.cancel()
		if let original {
			deliver(original)
		}
	}

	private func deliver(_ content: UNNotificationContent) {
		guard let handler = contentHandler else { return }
		contentHandler = nil
		handler(content)
	}

	private func communicationContent(
		_ content: UNNotificationContent,
		senderName: String,
		avatar: INImage?
	) -> UNNotificationContent {
		let info = content.userInfo
		let senderId = (info["messageAuthor"] as? String) ?? senderName
		let conversation = (info["channelUri"] as? String) ?? (info["channel"] as? String) ?? content.threadIdentifier

		let sender = INPerson(
			personHandle: INPersonHandle(value: senderId, type: .unknown),
			nameComponents: nil,
			displayName: senderName,
			image: avatar,
			contactIdentifier: nil,
			customIdentifier: senderId
		)

		let intent = INSendMessageIntent(
			recipients: nil,
			outgoingMessageType: .outgoingMessageText,
			content: content.body,
			speakableGroupName: nil,
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
