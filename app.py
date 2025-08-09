import os
import uuid
from flask import Flask, jsonify, request, render_template, session as flask_session
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, TIMESTAMP, Text, ForeignKey, func, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'todo.db')}"

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = "whowilleverguessthis"
CORS(app)

engine = create_engine(SQLALCHEMY_DATABASE_URI, echo=False, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class BoardList(Base):
    __tablename__ = "lists"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'), nullable=False)
    tasks = relationship("Task", back_populates="list", cascade="all, delete", passive_deletes=True)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    list_id = Column(Integer, ForeignKey("lists.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'), nullable=False)
    list = relationship("BoardList", back_populates="tasks")


Base.metadata.create_all(bind=engine)

db = SessionLocal()
if db.query(BoardList).count() == 0:
    sid = str(uuid.uuid4())
    starter_lists = [
        BoardList(title="To Do", position=1, session_id=sid),
        BoardList(title="In Progress", position=2, session_id=sid),
        BoardList(title="Completed", position=3, session_id=sid),
    ]
    db.add_all(starter_lists)
    db.commit()
db.close()


def get_sid():
    sid = flask_session.get("sid")
    if not sid:
        sid = str(uuid.uuid4())
        flask_session["sid"] = sid

    db = SessionLocal()
    if db.query(BoardList).filter_by(session_id=sid).count() == 0:
        starter_lists = [
            BoardList(title="To Do", position=1, session_id=sid),
            BoardList(title="In Progress", position=2, session_id=sid),
            BoardList(title="Completed", position=3, session_id=sid),
        ]
        db.add_all(starter_lists)
        db.commit()
    db.close()

    return sid


def serialize_task(t):
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "list_id": t.list_id,
        "created_at": t.created_at.isoformat() if t.created_at else None
    }

def serialize_list(l):
    return {
        "id": l.id,
        "title": l.title,
        "position": l.position,
        "created_at": l.created_at.isoformat() if l.created_at else None
    }


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/lists", methods=["GET"])
def get_lists():
    db = SessionLocal()
    try:
        sid = get_sid()
        lists = db.query(BoardList).filter_by(session_id=sid).order_by(BoardList.position).all()
        return jsonify([serialize_list(l) for l in lists])
    finally:
        db.close()

@app.route("/faq")
def faq():
    return render_template("faq.html")


@app.route("/api/lists", methods=["POST"])
def create_list():
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400
    db = SessionLocal()
    try:
        sid = get_sid()
        max_pos = db.query(func.max(BoardList.position)).filter_by(session_id=sid).scalar() or 0
        pos = data.get("position", max_pos + 1)
        new = BoardList(title=title, position=pos, session_id=sid)
        db.add(new)
        db.commit()
        db.refresh(new)
        return jsonify(serialize_list(new)), 201
    finally:
        db.close()

@app.route("/api/lists/<int:list_id>", methods=["PUT"])
def update_list(list_id):
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        sid = get_sid()
        l = session.query(BoardList).filter_by(id=list_id, session_id=sid).first()
        if not l:
            return jsonify({"error": "Not found"}), 404
        if "title" in data:
            l.title = data["title"]
        if "position" in data:
            l.position = int(data["position"])
        session.commit()
        return jsonify(serialize_list(l))
    finally:
        session.close()

@app.route("/api/lists/<int:list_id>", methods=["DELETE"])
def delete_list(list_id):
    db = SessionLocal()
    try:
        sid = get_sid()
        l = db.query(BoardList).filter_by(id=list_id, session_id=sid).first()
        if not l:
            return jsonify({"error": "Not found"}), 404
        db.delete(l)
        db.commit()
        return jsonify({"success": True})
    finally:
        db.close()

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    session = SessionLocal()
    try:
        sid = get_sid()
        tasks = session.query(Task).filter_by(session_id=sid).order_by(Task.created_at).all()
        return jsonify([serialize_task(t) for t in tasks])
    finally:
        session.close()

@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title required"}), 400

    sid = get_sid()
    session = SessionLocal()
    try:
        list_id = data.get("list_id")
        if not list_id:
            first = session.query(BoardList).filter_by(session_id=sid).order_by(BoardList.position).first()
            if not first:
                return jsonify({"error": "No lists exist"}), 400
            list_id = first.id
        else:
            exists = session.query(BoardList).filter_by(id=list_id, session_id=sid).first()
            if not exists:
                return jsonify({"error": "List not found"}), 404

        t = Task(title=title, description=data.get("description"), list_id=list_id, session_id=sid)
        session.add(t)
        session.commit()
        session.refresh(t)
        return jsonify(serialize_task(t)), 201
    finally:
        session.close()

@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.get_json() or {}
    session = SessionLocal()
    try:
        sid = get_sid()
        t = session.query(Task).filter_by(id=task_id, session_id=sid).first()
        if not t:
            return jsonify({"error": "Not found"}), 404

        if "list_id" in data:
            new_list = session.query(BoardList).filter_by(id=int(data["list_id"]), session_id=sid).first()
            if not new_list:
                return jsonify({"error": "List not found"}), 404
            t.list_id = int(data["list_id"])

        if "title" in data:
            t.title = data["title"]
        if "description" in data:
            t.description = data["description"]

        session.commit()
        return jsonify(serialize_task(t))
    finally:
        session.close()

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    session = SessionLocal()
    try:
        sid = get_sid()
        t = session.query(Task).filter_by(id=task_id, session_id=sid).first()
        if not t:
            return jsonify({"error": "Not found"}), 404
        session.delete(t)
        session.commit()
        return jsonify({"success": True})
    finally:
        session.close()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
