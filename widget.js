// Rapid Reply Chat Widget
(function() {
    'use strict';

    // Get config from page
    var config = window.RAPID_REPLY_CONFIG || {};
    var userId = config.userId;
    var webhookUrl = config.webhookUrl || 'https://n8n.ie-manage.com/webhook/live-chat';
    var theme = config.theme || 'blue';
    var logoUrl = config.logoUrl || '';
    var companyInitials = config.companyInitials || 'AI';
    var companyName = config.companyName || 'Support Assistant';

    // Session storage
    var SESSION_STORAGE_KEY = 'chatSessionId';
    var sessionId = null;
    var isTyping = false;

    // Create HTML structure
    var html = `
        <button id="rr-chat-button" aria-label="Open chat">
            <svg viewBox="0 0 24 24" id="rr-default-icon">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
        </button>

        <div id="rr-chat-widget" class="rr-theme-${theme}">
            <div class="rr-chat-header">
                <div class="rr-chat-header-top">
                    <div class="rr-chat-header-title">
                        <div class="rr-chat-avatar" id="rr-header-avatar">
                            <span id="rr-avatar-initials">${companyInitials}</span>
                        </div>
                        <div class="rr-chat-header-text">
                            <h3>${companyName}</h3>
                            <p><span class="rr-status-dot"></span>Online now</p>
                        </div>
                    </div>
                    <button class="rr-close-button" id="rr-close-chat" aria-label="Close chat">&times;</button>
                </div>
            </div>

            <div class="rr-contact-form" id="rr-contact-form">
                <div>
                    <h4>Welcome! 👋</h4>
                    <p>Let's get started with your information</p>
                </div>
                <div class="rr-form-group">
                    <label for="rr-email-input">Email address</label>
                    <input type="email" id="rr-email-input" placeholder="you@example.com" required>
                </div>
                <div class="rr-form-group">
                    <label for="rr-phone-input">Phone number</label>
                    <input type="tel" id="rr-phone-input" placeholder="+1 (555) 000-0000" required>
                </div>
                <div class="rr-error-message" id="rr-error-message"></div>
                <button id="rr-start-chat">Start Conversation</button>
            </div>

            <div class="rr-chat-messages" id="rr-chat-messages" style="display: none;"></div>
            <div class="rr-chat-input" id="rr-chat-input" style="display: none;">
                <div class="rr-input-wrapper">
                    <input type="text" id="rr-message-input" placeholder="Type your message...">
                    <button class="rr-send-button" id="rr-send-button" aria-label="Send message">
                        <svg viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Insert HTML into page
    document.body.insertAdjacentHTML('beforeend', html);

    // Get elements
    var chatButton = document.getElementById('rr-chat-button');
    var chatWidget = document.getElementById('rr-chat-widget');
    var closeChat = document.getElementById('rr-close-chat');
    var contactForm = document.getElementById('rr-contact-form');
    var emailInput = document.getElementById('rr-email-input');
    var phoneInput = document.getElementById('rr-phone-input');
    var startChatBtn = document.getElementById('rr-start-chat');
    var errorMessage = document.getElementById('rr-error-message');
    var chatMessages = document.getElementById('rr-chat-messages');
    var chatInput = document.getElementById('rr-chat-input');
    var messageInput = document.getElementById('rr-message-input');
    var sendButton = document.getElementById('rr-send-button');

    // Apply logo if provided
    if (logoUrl) {
        var buttonImg = document.createElement('img');
        buttonImg.src = logoUrl;
        buttonImg.alt = 'Chat';
        document.getElementById('rr-default-icon').style.display = 'none';
        chatButton.appendChild(buttonImg);

        var headerImg = document.createElement('img');
        headerImg.src = logoUrl;
        headerImg.alt = companyName;
        document.getElementById('rr-avatar-initials').style.display = 'none';
        document.getElementById('rr-header-avatar').appendChild(headerImg);
    }

    // Toggle chat
    chatButton.addEventListener('click', function() {
        chatWidget.classList.add('rr-open');
        chatButton.style.display = 'none';
        
        var savedSessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedSessionId) {
            sessionId = savedSessionId;
            showChatInterface();
        }
    });

    closeChat.addEventListener('click', function() {
        chatWidget.classList.remove('rr-open');
        chatButton.style.display = 'flex';
    });

    // Validation
    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePhone(phone) {
        return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }

    // Start chat
    startChatBtn.addEventListener('click', function() {
        var email = emailInput.value.trim();
        var phone = phoneInput.value.trim();

        errorMessage.textContent = '';

        if (!validateEmail(email)) {
            errorMessage.textContent = 'Please enter a valid email address';
            return;
        }

        if (!validatePhone(phone)) {
            errorMessage.textContent = 'Please enter a valid phone number';
            return;
        }

        startChatBtn.disabled = true;
        startChatBtn.textContent = 'Connecting...';

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'initialize',
                email: email,
                phone: phone,
                userId: userId,
                timestamp: Date.now()
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.sessionId) {
                sessionId = data.sessionId;
                sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
                showChatInterface();
                
                if (data.welcomeMessage) {
                    addMessage(data.welcomeMessage, 'bot');
                }
            } else {
                throw new Error('No session ID received');
            }
        })
        .catch(function(error) {
            console.error('Error:', error);
            errorMessage.textContent = 'Unable to connect. Please try again.';
            startChatBtn.disabled = false;
            startChatBtn.textContent = 'Start Conversation';
        });
    });

    function showChatInterface() {
        contactForm.style.display = 'none';
        chatMessages.style.display = 'flex';
        chatInput.style.display = 'block';
        messageInput.focus();
    }

    function addMessage(text, sender) {
        var messageDiv = document.createElement('div');
        messageDiv.className = 'rr-message rr-' + sender;
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTyping() {
        if (isTyping) return;
        isTyping = true;
        
        var typingDiv = document.createElement('div');
        typingDiv.className = 'rr-message rr-bot rr-typing';
        typingDiv.id = 'rr-typing-indicator';
        typingDiv.innerHTML = '<div class="rr-typing-indicator"><span></span><span></span><span></span></div>';
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
        isTyping = false;
        var typingDiv = document.getElementById('rr-typing-indicator');
        if (typingDiv) typingDiv.remove();
    }

    function sendMessage() {
        var message = messageInput.value.trim();
        if (!message || !sessionId) return;

        addMessage(message, 'user');
        messageInput.value = '';
        sendButton.disabled = true;
        messageInput.disabled = true;

        showTyping();

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'message',
                sessionId: sessionId,
                message: message,
                userId: userId,
                timestamp: Date.now()
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            hideTyping();
            if (data.reply) {
                addMessage(data.reply, 'bot');
            } else {
                throw new Error('No reply');
            }
        })
        .catch(function(error) {
            console.error('Error:', error);
            hideTyping();
            addMessage('Sorry, something went wrong. Please try again.', 'bot');
        })
        .finally(function() {
            sendButton.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        });
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
})();