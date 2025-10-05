// Rapid Reply Chat Widget - Fixed Version
(function() {
    'use strict';

    var config = window.RAPID_REPLY_CONFIG || {};
    var userId = config.userId;
    var webhookUrl = config.webhookUrl || 'https://n8n.ie-manage.com/webhook/live-chat';
    var theme = config.theme || 'blue';
    var logoUrl = config.logoUrl || '';
    var companyInitials = config.companyInitials || 'RR';
    var companyName = config.companyName || 'Support';

    var SESSION_STORAGE_KEY = 'chatSessionId';
    var sessionId = null;
    var isTyping = false;
    var isAgentMode = false;
    var pollInterval = null;
    var conversationHistory = [];
    var clientEmail = '';
    var clientPhone = '';
    var clientName = '';
    var businessHours = null;
    var canTransferToAgent = false;

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
                <div id="rr-powered-by" style="text-align: center; padding: 8px; font-size: 11px; color: rgba(255,255,255,0.7); border-top: 1px solid rgba(255,255,255,0.1);">
                    Powered by RapidReply
                </div>
            </div>

            <div class="rr-contact-form" id="rr-contact-form">
                <div>
                    <h4>Welcome!</h4>
                    <p>Let's get started with your information</p>
                </div>
                <div class="rr-form-group">
                    <label for="rr-name-input">Full Name</label>
                    <input type="text" id="rr-name-input" placeholder="John Doe" required>
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
                Connecting you to a live agent...
            </div>

            <div class="rr-chat-messages" id="rr-chat-messages" style="display: none;"></div>
            
            <div class="rr-chat-input" id="rr-chat-input" style="display: none;">
                <button id="rr-request-agent" class="rr-agent-button" style="display: none; width: 100%; padding: 10px; margin-bottom: 10px; background: white; color: #3b82f6; border: 2px solid #3b82f6; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                    Talk to Live Agent
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

    document.body.insertAdjacentHTML('beforeend', html);

    var chatButton = document.getElementById('rr-chat-button');
    var chatWidget = document.getElementById('rr-chat-widget');
    var closeChat = document.getElementById('rr-close-chat');
    var contactForm = document.getElementById('rr-contact-form');
    var nameInput = document.getElementById('rr-name-input');
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
        stopPolling();
    });

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validatePhone(phone) {
        return /^[\d\s\-\+\(\)]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
    }

    function checkBusinessHours() {
        if (!businessHours) return true; // Default to allowing if no hours set
        
        var now = new Date();
        var currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        var currentTime = now.getHours() * 60 + now.getMinutes();
        
        var todayHours = businessHours[currentDay];
        if (!todayHours || todayHours.closed) return false;
        
        var startParts = todayHours.start.split(':');
        var endParts = todayHours.end.split(':');
        var startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        var endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        
        return currentTime >= startMinutes && currentTime <= endMinutes;
    }

    function getBusinessHoursMessage() {
        if (!businessHours) return '';
        
        var message = 'Our support hours are: ';
        var days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        var hours = [];
        
        days.forEach(function(day) {
            var dayHours = businessHours[day];
            if (dayHours && !dayHours.closed) {
                hours.push(day.charAt(0).toUpperCase() + day.slice(1) + ': ' + dayHours.start + ' - ' + dayHours.end);
            }
        });
        
        return message + hours.join(', ');
    }

    startChatBtn.addEventListener('click', function() {
        var name = nameInput.value.trim();
        var email = emailInput.value.trim();
        var phone = phoneInput.value.trim();

        errorMessage.textContent = '';

        if (!name) {
            errorMessage.textContent = 'Please enter your name';
            return;
        }

        if (!validateEmail(email)) {
            errorMessage.textContent = 'Please enter a valid email address';
            return;
        }

        if (!validatePhone(phone)) {
            errorMessage.textContent = 'Please enter a valid phone number';
            return;
        }

        clientName = name;
        clientEmail = email;
        clientPhone = phone;

        startChatBtn.disabled = true;
        startChatBtn.textContent = 'Connecting...';

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'initialize',
                name: name,
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
                
                if (data.businessHours) {
                    businessHours = data.businessHours;
                    canTransferToAgent = checkBusinessHours();
                }
                
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
                clientName: clientName,
                clientEmail: clientEmail,
                clientPhone: clientPhone,
                timestamp: Date.now()
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            hideTyping();
            if (!isAgentMode && data.reply) {
                addMessage(data.reply, 'bot');
                
                // Only show agent button if AI explicitly says to
                if (data.shouldOfferAgent === true) {
                    if (canTransferToAgent) {
                        requestAgentBtn.style.display = 'block';
                    } else {
                        var hoursMsg = getBusinessHoursMessage();
                        addMessage("I'd be happy to connect you with a live agent, but our support team is currently offline. " + hoursMsg, 'bot');
                    }
                }
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

    function requestLiveAgent() {
        if (isAgentMode) return;
        
        if (!canTransferToAgent) {
            var hoursMsg = getBusinessHoursMessage();
            addMessage("Our support team is currently offline. " + hoursMsg + " Please try again during business hours!", 'bot');
            return;
        }
        
        isAgentMode = true;
        agentBanner.style.display = 'block';
        chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #fbbf24;"></span>Connecting to agent...';
        requestAgentBtn.disabled = true;
        requestAgentBtn.textContent = 'Agent Requested';
        requestAgentBtn.style.opacity = '0.5';

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'handoff',
                userId: userId,
                sessionId: sessionId,
                clientName: clientName,
                clientEmail: clientEmail,
                clientPhone: clientPhone,
                conversationHistory: conversationHistory,
                timestamp: Date.now(),
                status: 'active'
            })
        })
        .then(function(response) { return response.json(); })
        .then(function(data) {
            addMessage('Connecting you to a live agent. Please wait...', 'bot');
            startPollingForAgentMessages();
        })
        .catch(function(error) {
            console.error('Error requesting agent:', error);
            addMessage('Could not connect to agent. Please try again.', 'bot');
            isAgentMode = false;
            agentBanner.style.display = 'none';
            chatStatus.innerHTML = '<span class="rr-status-dot"></span>Online now';
            requestAgentBtn.disabled = false;
            requestAgentBtn.textContent = 'Talk to Live Agent';
            requestAgentBtn.style.opacity = '1';
        });
    }

    function startPollingForAgentMessages() {
        if (pollInterval) return;
        
        pollInterval = setInterval(function() {
            fetch(webhookUrl + '?action=poll&userId=' + userId + '&sessionId=' + sessionId)
                .then(function(response) { return response.json(); })
                .then(function(data) {
                    if (data.messages && Array.isArray(data.messages)) {
                        data.messages.forEach(function(msg) {
                            var exists = conversationHistory.find(function(m) {
                                return m.timestamp === msg.timestamp;
                            });
                            
                            if (!exists && msg.sender === 'agent') {
                                addMessage(msg.text, 'agent');
                                
                                if (chatStatus.textContent.includes('Connecting')) {
                                    chatStatus.innerHTML = '<span class="rr-status-dot" style="background: #10b981;"></span>Live Agent';
                                    agentBanner.innerHTML = 'Connected to live agent';
                                    agentBanner.style.background = '#d1fae5';
                                    agentBanner.style.borderColor = '#10b981';
                                    agentBanner.style.color = '#065f46';
                                }
                            }
                        });
                    }
                    
                    if (data.status === 'closed') {
                        stopPolling();
                        addMessage('This session has been closed. Thank you!', 'bot');
                        isAgentMode = false;
                        agentBanner.style.display = 'none';
                        chatStatus.innerHTML = '<span class="rr-status-dot"></span>Online now';
                    }
                })
                .catch(function(error) {
                    console.error('Error polling for messages:', error);
                });
        }, 3000);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    requestAgentBtn.addEventListener('click', requestLiveAgent);
})();