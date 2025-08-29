from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import subprocess
import threading
import queue
import sys
import io
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Queue for managing command execution
command_queue = queue.Queue()
current_process = None

def run_command(command, session_id):
    """Execute command and stream output to client"""
    global current_process
    
    try:
        # Split command into list if it's a string
        if isinstance(command, str):
            cmd_parts = command.strip().split()
        else:
            cmd_parts = command
        
        # Add python -m bcsfe prefix if not present
        if not (len(cmd_parts) >= 3 and cmd_parts[0] == 'python' and cmd_parts[1] == '-m' and cmd_parts[2] == 'bcsfe'):
            if cmd_parts[0] == 'bcsfe':
                cmd_parts = ['python', '-m'] + cmd_parts
            else:
                cmd_parts = ['python', '-m', 'bcsfe'] + cmd_parts
        
        # Create process
        current_process = subprocess.Popen(
            cmd_parts,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Stream output line by line
        for line in iter(current_process.stdout.readline, ''):
            if line:
                socketio.emit('output', {
                    'data': line,
                    'session_id': session_id
                }, room=session_id)
        
        current_process.wait()
        
        # Send completion signal
        socketio.emit('command_complete', {
            'session_id': session_id
        }, room=session_id)
        
    except Exception as e:
        socketio.emit('output', {
            'data': f"Error: {str(e)}\n",
            'session_id': session_id,
            'error': True
        }, room=session_id)
        socketio.emit('command_complete', {
            'session_id': session_id
        }, room=session_id)
    finally:
        current_process = None

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def handle_connect():
    session_id = request.sid
    emit('connected', {'session_id': session_id})

@socketio.on('join')
def on_join(data):
    session_id = data['session_id']
    threading.Thread(target=lambda: socketio.server.manager.rooms['/'].add(session_id, request.sid)).start()

@socketio.on('execute_command')
def handle_command(data):
    command = data.get('command', '')
    session_id = request.sid
    
    if command.strip():
        # Start command execution in a separate thread
        thread = threading.Thread(target=run_command, args=(command, session_id))
        thread.daemon = True
        thread.start()

@socketio.on('execute_batch')
def handle_batch(data):
    commands = data.get('commands', '')
    session_id = request.sid
    
    # Split commands by newline and filter empty lines
    command_list = [cmd.strip() for cmd in commands.split('\n') if cmd.strip()]
    
    def run_batch():
        for i, command in enumerate(command_list):
            socketio.emit('output', {
                'data': f"\n=== Executing command {i+1}/{len(command_list)}: {command} ===\n",
                'session_id': session_id,
                'info': True
            }, room=session_id)
            run_command(command, session_id)
    
    # Start batch execution in a separate thread
    thread = threading.Thread(target=run_batch)
    thread.daemon = True
    thread.start()

@socketio.on('stop_command')
def handle_stop():
    global current_process
    if current_process:
        current_process.terminate()
        socketio.emit('output', {
            'data': "\n=== Command terminated by user ===\n",
            'session_id': request.sid,
            'warning': True
        }, room=request.sid)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False)