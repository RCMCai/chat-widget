// Rapid Reply Chat Widget - WITH LIVE AGENT SUPPORT
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
    
    // LIVE AGENT SUPPORT - NEW VARIABLES
    var isAgentMode = false;
    var pollInterval = null;
    var conversationHistory = [];
    var clientEmail = '';
    var clientPhone = '';

    // Create HTML structure - UPDATED WITH LIVE AGENT BUTTON
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
                            <p id="rr-chat-status"><span class="rr-status-dot"></span>Online now</p>
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

            <div id="rr-agent-banner" style="display: none; background: #fef3c7; border-top: 2px solid #fbbf24; padding: 10px; text-align: center; font-size: 13px; color: #92400e;">
                🟡 Connecting you to a live agent...
            </div>

            <div class="rr-chat-messages" id="rr-chat-messages" style="display: none;"></div>
            
            <div class="rr-chat-input" id="rr-chat-input" style="display: none;">
                <button id="rr-request-agent" class="rr-agent-button" style="width: 100%; padding: 10px; margin-bottom: 10px; background: white; color: #3b82f6; border: 2px solid #3b82f6; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                    💬 Talk to Live Agent
                </button>
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
    var requestAgentBtn = document.getElementById('rr-request-agent');
    var agentBanner = document.getElementById('rr-agent-banner');
    var chatStatus = document.getElementById('rr-chat-status');

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
        stopPolling(); // Stop polling when closing
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

        // Store client info for later use
        clientEmail = email;
        clientPhone = phone;

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
        
        // Add label for agent messages
        if (sender === 'agent') {
            var agentLabel = document.createElement('div');
            agentLabel.style.fontSize = '10px';
            agentLabel.style.fontWeight = 'bold';
            agentLabel.style.marginBottom = '4px';
            agentLabel.style.opacity = '0.9';
            agentLabel.textContent = 'LIVE AGENT';
            messageDiv.appendChild(agentLabel);
        }
        
        var textNode = document.createTextNode(text);
        messageDiv.appendChild(textNode);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Add to conversation history
        conversationHistory.push({
            text: text,
            sender: sender,
            timestamp: new Date().toISOString()
        });
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

        // Only show typing if not in agent mode
        if (!isAgentMode) {
            showTyping();
        }

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'message',
                sessionId: sessionId,
                message: message,
                userId: userId,
                agentMode: isAgentMode,
                clientEmail: clientEmail,
                clientPhone: clientPhone,
                timestamp: Date.now()
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            hideTyping();
            // Only add AI reply if not in agent mode
            if (!isAgentMode && data.reply) {
                addMessage(data.reply, 'bot');
            }
        })
        .catch(function(error) {
            console.error('Error:', error);
            hideTyping();
            if (!isAgentMode) {
                addMessage('Sorry, something went wrong. Please try again.', 'bot');
            }
        })
        .finally(function() {
            sendButton.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        });
    }

    // REQUEST LIVE AGENT - NEW FUNCTION
    function requestLiveAgent() {
        if (isAgentMode) return;
        
        isAgentMode = true;
        
        // Update UI
        agentBanner.style.display = 'block';
        chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #fbbf24;"></span>Connecting to agent...';
        requestAgentBtn.disabled = true;
        requestAgentBtn.textContent = '⏳ Agent Requested';
        requestAgentBtn.style.opacity = '0.5';

        // Send handoff request
        fetch(webhookUrl + '-handoff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                sessionId: sessionId,
                clientEmail: clientEmail,
                clientPhone: clientPhone,
                conversationHistory: conversationHistory,
                timestamp: new Date().toISOString(),
                status: 'active'
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            addMessage('🟡 Connecting you to a live agent. Please wait...', 'bot');
            startPollingForAgentMessages();
        })
        .catch(function(error) {
            console.error('Error requesting agent:', error);
            addMessage('⚠️ Could not connect to agent. Please try again.', 'bot');
            isAgentMode = false;
            agentBanner.style.display = 'none';
            chatStatus.innerHTML = '<span class="rr-status-dot"></span>Online now';
            requestAgentBtn.disabled = false;
            requestAgentBtn.textContent = '💬 Talk to Live Agent';
            requestAgentBtn.style.opacity = '1';
        });
    }

    // POLL FOR AGENT MESSAGES - NEW FUNCTION
    function startPollingForAgentMessages() {
        if (pollInterval) return;
        
        pollInterval = setInterval(function() {
            fetch(webhookUrl + '-poll?userId=' + userId + '&sessionId=' + sessionId)
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.messages && Array.isArray(data.messages)) {
                        data.messages.forEach(function(msg) {
                            // Only add if not already in history
                            var exists = conversationHistory.find(function(m) {
                                return m.timestamp === msg.timestamp;
                            });
                            
                            if (!exists && msg.sender === 'agent') {
                                addMessage(msg.text, 'agent');
                                
                                // Update status on first agent message
                                if (chatStatus.textContent.includes('Connecting')) {
                                    chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #10b981;"></span>Live Agent';
                                    agentBanner.innerHTML = '🟢 Connected to live agent';
                                    agentBanner.style.background = '#d1fae5';
                                    agentBanner.style.borderColor = '#10b981';
                                    agentBanner.style.color = '#065f46';
                                }
                            }
                        });
                    }
                    
                    // Check if session was closed
                    if (data.status === 'closed') {
                        stopPolling();
                        addMessage('This session has been closed by the agent. Thank you!', 'bot');
                        isAgentMode = false;
                        agentBanner.style.display = 'none';
                        chatStatus.innerHTML = '<span class="rr-status-dot"></span>Online now';
                    }
                })
                .catch(function(error) {
                    console.error('Error polling for messages:', error);
                });
        }, 3000); // Poll every 3 seconds
    }

    // STOP POLLING - NEW FUNCTION
    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    requestAgentBtn.addEventListener('click', requestLiveAgent);
})();