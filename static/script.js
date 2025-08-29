// Initialize Socket.IO connection
const socket = io();
let sessionId = null;
let isExecuting = false;

// DOM Elements
const consoleElement = document.getElementById('console');
const singleCommandInput = document.getElementById('singleCommand');
const batchCommandsInput = document.getElementById('batchCommands');
const executeBtn = document.getElementById('executeBtn');
const submitBatchBtn = document.getElementById('submitBatchBtn');
const clearBtn = document.getElementById('clearBtn');
const stopBtn = document.getElementById('stopBtn');
const statusElement = document.getElementById('status');
const connectionStatus = document.getElementById('connectionStatus');

// Socket Events
socket.on('connect', () => {
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.add('connected');
    updateStatus('Ready');
});

socket.on('disconnect', () => {
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.remove('connected');
    updateStatus('Disconnected');
});

socket.on('connected', (data) => {
    sessionId = data.session_id;
    socket.emit('join', { session_id: sessionId });
    appendToConsole('Connected to BCSFE CLI Interface\n', 'info');
    appendToConsole('Type "help" or "bcsfe --help" to get started\n\n', 'info');
});

socket.on('output', (data) => {
    let className = '';
    if (data.error) className = 'error';
    else if (data.warning) className = 'warning';
    else if (data.info) className = 'info';
    
    appendToConsole(data.data, className);
});

socket.on('command_complete', () => {
    isExecuting = false;
    updateStatus('Ready');
    enableInputs();
});

// Functions
function appendToConsole(text, className = '') {
    const span = document.createElement('span');
    span.textContent = text;
    if (className) span.className = className;
    consoleElement.appendChild(span);
    consoleElement.scrollTop = consoleElement.scrollHeight;
}

function updateStatus(status) {
    statusElement.textContent = status;
}

function disableInputs() {
    executeBtn.disabled = true;
    submitBatchBtn.disabled = true;
    singleCommandInput.disabled = true;
    batchCommandsInput.disabled = true;
}

function enableInputs() {
    executeBtn.disabled = false;
    submitBatchBtn.disabled = false;
    singleCommandInput.disabled = false;
    batchCommandsInput.disabled = false;
}

function executeCommand(command) {
    if (!command.trim()) return;
    
    isExecuting = true;
    disableInputs();
    updateStatus('Executing...');
    
    appendToConsole(`$ ${command}\n`, 'command');
    socket.emit('execute_command', { command: command });
}

function executeBatch(commands) {
    if (!commands.trim()) return;
    
    isExecuting = true;
    disableInputs();
    updateStatus('Executing batch...');
    
    socket.emit('execute_batch', { commands: commands });
}

// Event Listeners
executeBtn.addEventListener('click', () => {
    if (!isExecuting) {
        executeCommand(singleCommandInput.value);
        singleCommandInput.value = '';
    }
});

singleCommandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isExecuting) {
        executeCommand(singleCommandInput.value);
        singleCommandInput.value = '';
    }
});

submitBatchBtn.addEventListener('click', () => {
    if (!isExecuting) {
        executeBatch(batchCommandsInput.value);
    }
});

clearBtn.addEventListener('click', () => {
    consoleElement.innerHTML = '';
    appendToConsole('Console cleared\n\n', 'info');
});

stopBtn.addEventListener('click', () => {
    if (isExecuting) {
        socket.emit('stop_command');
        isExecuting = false;
        enableInputs();
        updateStatus('Stopped');
    }
});

// Command history (optional feature)
let commandHistory = [];
let historyIndex = -1;

singleCommandInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            singleCommandInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            singleCommandInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
        } else if (historyIndex === 0) {
            historyIndex = -1;
            singleCommandInput.value = '';
        }
    }
});

// Store command in history
function addToHistory(command) {
    if (command && command !== commandHistory[commandHistory.length - 1]) {
        commandHistory.push(command);
        if (commandHistory.length > 50) {
            commandHistory.shift();
        }
    }
    historyIndex = -1;
}

// Modified execute function to include history
const originalExecuteCommand = executeCommand;
executeCommand = function(command) {
    addToHistory(command);
    originalExecuteCommand(command);
};