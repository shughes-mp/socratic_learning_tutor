import os, re, uuid
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import anthropic

# Load .env if present
env_path = Path(__file__).parent / '.env'
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

app = Flask(__name__, static_folder='static')
CORS(app)

client = anthropic.Anthropic()

sessions = {}


def build_system_prompt(session):
    reading_text = '\n\n'.join(
        '=== READING: ' + r['name'] + ' ===\n' + r['content']
        for r in session['readings']
    )
    assessment_text = '\n\n'.join(
        '=== ASSESSMENT (never answer directly): ' + a['name'] + ' ===\n' + a['content']
        for a in session['assessments']
    )

    if assessment_text:
        assessment_section = 'ASSESSMENT MATERIALS (never answer directly, only give feedback on learner responses):\n' + assessment_text
    else:
        assessment_section = ''

    if not reading_text:
        reading_text = '[No readings loaded yet — engage based on general knowledge but note this to the student.]'

    return (
        "You are a Socratic tutor for adult professional learners who hold college degrees. "
        "Your role is to help them deeply understand course readings so they are prepared to apply concepts in class discussions.\n\n"
        "CORE RULES:\n"
        "1. Never give a direct answer to a conceptual question unless the learner has made at least 3 genuine attempts at that question. The system will tell you the attempt count.\n"
        "2. Use guiding questions to help learners construct their own understanding.\n"
        "3. When a learner gets something wrong, give constructive, professional corrective feedback — specific about what is incorrect and why, without being harsh.\n"
        "4. If a learner is stuck, try drawing an analogy to professional or everyday contexts they likely know from work experience.\n"
        "5. After the 3rd attempt at any question, you MAY give a direct, complete answer.\n"
        "6. NEVER directly answer questions that appear in the assessment materials. You may give feedback on student-provided answers, but never supply the answers yourself.\n"
        "7. Keep responses focused and appropriately concise — these are professionals.\n"
        "8. If you detect a misconception in the student's response, append this exact line at the end of your reply:\n"
        "   MISCONCEPTION_LOG: <one sentence describing the specific misconception>\n"
        "9. When you give a direct answer (after 3 attempts), append:\n"
        "   DIRECT_ANSWER_LOG: <brief note on what was answered>\n\n"
        "READINGS (use as primary source):\n"
        + reading_text
        + ('\n\n' + assessment_section if assessment_section else '')
    )


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/session/new', methods=['POST'])
def new_session():
    sid = str(uuid.uuid4())
    sessions[sid] = {
        'readings': [], 'assessments': [], 'messages': [],
        'misconceptions': [], 'direct_answers': 0, 'log': [],
        'student_name': '', 'session_name': '',
        'course_description': '', 'student_profile': ''
    }
    return jsonify({'session_id': sid})


@app.route('/api/session/<sid>/config', methods=['POST'])
def config_session(sid):
    if sid not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    data = request.json
    sessions[sid]['session_name'] = data.get('session_name', '')
    sessions[sid]['course_description'] = data.get('course_description', '')
    sessions[sid]['student_profile'] = data.get('student_profile', '')
    return jsonify({'ok': True})


@app.route('/api/session/<sid>/upload', methods=['POST'])
def upload_file(sid):
    if sid not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    file = request.files.get('file')
    ftype = request.form.get('type', 'reading')
    if not file:
        return jsonify({'error': 'No file'}), 400

    if file.filename.lower().endswith('.pdf'):
        content = extract_pdf_text(file)
    else:
        content = file.read().decode('utf-8', errors='replace')

    entry = {'name': file.filename, 'content': content}
    if ftype == 'reading':
        sessions[sid]['readings'].append(entry)
    else:
        sessions[sid]['assessments'].append(entry)
    return jsonify({'ok': True, 'name': file.filename, 'type': ftype})


def extract_pdf_text(file):
    try:
        import pypdf
        import io
        reader = pypdf.PdfReader(io.BytesIO(file.read()))
        return '\n'.join(page.extract_text() or '' for page in reader.pages)
    except ImportError:
        return '[PDF extraction unavailable — install pypdf: pip install pypdf]'


@app.route('/api/session/<sid>/files', methods=['GET'])
def list_files(sid):
    if sid not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    s = sessions[sid]
    return jsonify({
        'readings': [r['name'] for r in s['readings']],
        'assessments': [a['name'] for a in s['assessments']]
    })


@app.route('/api/session/<sid>/remove', methods=['POST'])
def remove_file(sid):
    if sid not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    data = request.json
    ftype = data.get('type')
    name = data.get('name')
    key = 'readings' if ftype == 'reading' else 'assessments'
    sessions[sid][key] = [f for f in sessions[sid][key] if f['name'] != name]
    return jsonify({'ok': True})


@app.route('/api/session/<sid>/chat', methods=['POST'])
def chat(sid):
    if sid not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    s = sessions[sid]
    data = request.json
    user_msg = data.get('message', '').strip()
    attempt_count = data.get('attempt_count', 0)
    student_name = data.get('student_name', '')
    s['student_name'] = student_name

    if not user_msg:
        return jsonify({'error': 'Empty message'}), 400

    if attempt_count >= 3:
        context_note = '[TUTOR CONTEXT: attempt_count=' + str(attempt_count) + '. You may now give a direct answer.]'
    else:
        context_note = '[TUTOR CONTEXT: attempt_count=' + str(attempt_count) + '. Do not give a direct answer yet — use guiding questions.]'

    augmented = user_msg + '\n\n' + context_note
    s['messages'].append({'role': 'user', 'content': augmented})

    response = client.messages.create(
        model='claude-sonnet-4-5',
        max_tokens=1000,
        system=build_system_prompt(s),
        messages=s['messages']
    )

    raw = response.content[0].text
    misc_match = re.search(r'MISCONCEPTION_LOG:\s*(.+)', raw)
    direct_match = re.search(r'DIRECT_ANSWER_LOG:\s*(.+)', raw)

    if misc_match:
        s['misconceptions'].append({
            'text': misc_match.group(1).strip(),
            'student': student_name or 'anonymous',
            'user_msg': user_msg
        })
    if direct_match:
        s['direct_answers'] += 1

    clean = re.sub(r'MISCONCEPTION_LOG:.+', '', raw)
    clean = re.sub(r'DIRECT_ANSWER_LOG:.+', '', clean).strip()

    s['messages'][-1] = {'role': 'user', 'content': user_msg}
    s['messages'].append({'role': 'assistant', 'content': clean})
    s['log'].append({'student': user_msg, 'tutor': clean})

    return jsonify({
        'reply': clean,
        'misconception': misc_match.group(1).strip() if misc_match else None,
        'direct_answer': bool(direct_match)
    })


@app.route('/api/session/<sid>/greet', methods=['POST'])
def greet(sid):
    if sid not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    s = sessions[sid]
    data = request.json or {}
    student_name = data.get('student_name', '')
    session_name = s.get('session_name', '')

    if student_name:
        greeting_prompt = 'Please greet the student named ' + student_name + ' warmly but briefly.'
    else:
        greeting_prompt = 'Please greet the student warmly but briefly.'

    if session_name:
        greeting_prompt += ' Introduce yourself as their Socratic tutor for ' + session_name + '.'
    else:
        greeting_prompt += ' Introduce yourself as their Socratic tutor for the course readings.'

    greeting_prompt += ' Invite them to ask their first question or share what they are curious about. Keep it to 2-3 sentences.'

    response = client.messages.create(
        model='claude-sonnet-4-5',
        max_tokens=200,
        system=build_system_prompt(s),
        messages=[{'role': 'user', 'content': greeting_prompt}]
    )
    reply = response.content[0].text.strip()
    s['messages'].append({'role': 'assistant', 'content': reply})
    return jsonify({'reply': reply})


@app.route('/api/session/<sid>/report', methods=['GET'])
def get_report(sid):
    if sid not in sessions:
        return jsonify({'error': 'Session not found'}), 404
    s = sessions[sid]

    exchange_count = len([m for m in s['messages'] if m['role'] == 'user'])
    if exchange_count == 0:
        return jsonify({'report': None, 'stats': {'exchanges': 0, 'misconceptions': 0, 'direct_answers': 0}})

    log_text = '\n\n---\n\n'.join(
        'Exchange ' + str(i+1) + '\nStudent: ' + e['student'] + '\nTutor: ' + e['tutor']
        for i, e in enumerate(s['log'])
    )
    if s['misconceptions']:
        misc_text = '\n'.join(
            '- ' + m['text'] + ' (student msg: "' + m['user_msg'][:60] + '")'
            for m in s['misconceptions']
        )
    else:
        misc_text = 'None detected.'

    report_system = (
        "You generate concise instructor debriefs from Socratic tutoring sessions. "
        "Write in professional direct prose. No preamble or meta-commentary. "
        "Use these plain section headers: SESSION OVERVIEW, CONCEPTS ENGAGED WELL, "
        "MISCONCEPTIONS AND GAPS, SUGGESTED TEACHING APPROACHES. "
        "Under 450 words. Be specific — name the actual concepts and misconceptions."
    )

    report_user = (
        'Session: ' + s.get('session_name', 'Unnamed') + '\n'
        'Student: ' + (s['student_name'] or 'anonymous') + '\n'
        'Exchanges: ' + str(exchange_count) + '\n'
        'Direct answers given: ' + str(s['direct_answers']) + '\n\n'
        'Detected misconceptions:\n' + misc_text + '\n\n'
        'Full session log:\n' + log_text
    )

    response = client.messages.create(
        model='claude-sonnet-4-5',
        max_tokens=1000,
        system=report_system,
        messages=[{'role': 'user', 'content': report_user}]
    )

    return jsonify({
        'report': response.content[0].text,
        'stats': {
            'exchanges': exchange_count,
            'misconceptions': len(s['misconceptions']),
            'direct_answers': s['direct_answers']
        }
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 7860))
    app.run(host='0.0.0.0', port=port, debug=False)
