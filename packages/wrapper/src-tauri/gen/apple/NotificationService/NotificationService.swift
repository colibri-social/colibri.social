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
		let content = withSubtitle(request.content)
		original = content

		guard let senderName = content.userInfo["authorName"] as? String else {
			deliver(content)
			return
		}

		let avatarURL = (content.userInfo["authorAvatarUrl"] as? String).flatMap(URL.init(string:))
		guard let avatarURL else {
			deliver(communicationContent(content, senderName: senderName, avatar: nil))
			return
		}

		task = URLSession.shared.dataTask(with: avatarURL) { [weak self] data, response, _ in
			guard let self else { return }
			let ok = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? false
			let avatar = ok ? data.map { INImage(imageData: $0) } : nil
			self.deliver(self.communicationContent(content, senderName: senderName, avatar: avatar))
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
