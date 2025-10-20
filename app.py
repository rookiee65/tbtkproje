from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
import os

# Flask uygulaması (static ve templates klasörleri belirtildi)
app = Flask(
    __name__,
    static_folder='static',
    template_folder='templates'
)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///markers.db'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
db = SQLAlchemy(app)

class Marker(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120))
    description = db.Column(db.Text)
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    color = db.Column(db.String(20))
    photo_path = db.Column(db.String(300))
    audio_path = db.Column(db.String(300))
    is_path = db.Column(db.Boolean, default=False)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/markers', methods=['GET'])
def get_markers():
    markers = Marker.query.all()
    data = [{
        'id': m.id, 'title': m.title, 'description': m.description,
        'lat': m.lat, 'lng': m.lng, 'color': m.color,
        'photo_path': m.photo_path, 'audio_path': m.audio_path,
        'is_path': m.is_path
    } for m in markers]
    return jsonify(data)

@app.route('/api/markers', methods=['POST'])
def add_marker():
    title = request.form.get('title', '')
    description = request.form.get('description', '')
    lat = float(request.form.get('lat', 0))
    lng = float(request.form.get('lng', 0))
    color = request.form.get('color', '#2e6de4')
    is_path = request.form.get('is_path') == '1'

    photo_path = None
    audio_path = None

    photo = request.files.get('photo')
    if photo and photo.filename:
        filename = secure_filename(photo.filename)
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        photo.save(path)
        photo_path = '/' + path.replace('\\', '/')

    audio = request.files.get('audio')
    if audio and audio.filename:
        filename = secure_filename(audio.filename)
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        audio.save(path)
        audio_path = '/' + path.replace('\\', '/')

    marker = Marker(
        title=title, description=description, lat=lat, lng=lng,
        color=color, photo_path=photo_path, audio_path=audio_path, is_path=is_path
    )
    db.session.add(marker)
    db.session.commit()
    return jsonify({'status': 'ok', 'id': marker.id})

@app.route('/api/marker/<int:id>', methods=['GET'])
def get_marker(id):
    marker = Marker.query.get_or_404(id)
    return jsonify({
        'id': marker.id, 'title': marker.title, 'description': marker.description,
        'lat': marker.lat, 'lng': marker.lng, 'color': marker.color,
        'photo_path': marker.photo_path, 'audio_path': marker.audio_path,
        'is_path': marker.is_path
    })

@app.route('/api/marker/<int:id>', methods=['PUT'])
def update_marker(id):
    marker = Marker.query.get_or_404(id)
    marker.title = request.form.get('title', marker.title)
    marker.description = request.form.get('description', marker.description)
    marker.color = request.form.get('color', marker.color)

    photo = request.files.get('photo')
    if photo and photo.filename:
        filename = secure_filename(photo.filename)
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        photo.save(path)
        marker.photo_path = '/' + path.replace('\\', '/')

    audio = request.files.get('audio')
    if audio and audio.filename:
        filename = secure_filename(audio.filename)
        path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        audio.save(path)
        marker.audio_path = '/' + path.replace('\\', '/')

    db.session.commit()
    return jsonify({'status': 'updated'})

@app.route('/api/markers/<int:id>', methods=['DELETE'])
def delete_marker(id):
    marker = Marker.query.get_or_404(id)
    db.session.delete(marker)
    db.session.commit()
    return jsonify({'status': 'deleted'})

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    with app.app_context():
        db.create_all()
    app.run(debug=True, use_reloader=False)
