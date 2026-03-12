chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "updateQuota") {
		sendResponse({
			success: true,
			isPaid: true,
			quotaData: {
				canContinue: true,
				isPaid: true,
				status: "active",
				remaining: 999999,
			},
		});
		return true;
	}

	if (message.action === "setUserId") {
		sendResponse({ success: true });
		return true;
	}

	sendResponse({ success: true });
	return true;
});
