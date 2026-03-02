"""
개발 서버 (WSL/Linux용)
- GUI 없이 Flask 서버만 실행
- winreg 등 Windows 전용 모듈 우회
"""

import sys
import os
import threading
import time
import types

# winreg 모크 (Linux에서 config.py import 시 에러 방지)
winreg_mock = types.ModuleType('winreg')
winreg_mock.HKEY_CURRENT_USER = None
winreg_mock.HKEY_LOCAL_MACHINE = None
winreg_mock.HKEY_CLASSES_ROOT = None
winreg_mock.HKEY_USERS = None
winreg_mock.KEY_READ = 0
winreg_mock.KEY_SET_VALUE = 0
winreg_mock.KEY_ALL_ACCESS = 0
winreg_mock.REG_SZ = 0
class _FakeRegKey:
    def __enter__(self): return self
    def __exit__(self, *a): pass
    def Close(self): pass
winreg_mock.OpenKey = lambda *args, **kwargs: _FakeRegKey()
winreg_mock.QueryValueEx = lambda *args, **kwargs: None
winreg_mock.SetValueEx = lambda *args, **kwargs: None
winreg_mock.DeleteValue = lambda *args, **kwargs: None
winreg_mock.CloseKey = lambda *args, **kwargs: None
winreg_mock.EnumKey = lambda *args, **kwargs: (_ for _ in ()).throw(OSError)
winreg_mock.EnumValue = lambda *args, **kwargs: (_ for _ in ()).throw(OSError)
sys.modules['winreg'] = winreg_mock

from flask import Flask
from flask_cors import CORS
from config import load_config

config = load_config()


def create_mssql_app():
    """MSSQL Flask 앱 생성"""
    from services import mssql_db
    from services.mssql_loader import load_mssql_routes

    mssql_db.initialize_pool(config.get("mssql", {}))
    mssql_bp, version, source = load_mssql_routes(use_builtin=True)
    print(f"[MSSQL] Routes: v{version} ({source})")

    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(mssql_bp)
    return app


def create_postgres_app():
    """PostgreSQL Flask 앱 생성"""
    from services import postgres_db
    from routes.postgres_routes import postgres_bp
    from routes.file_routes import file_bp
    from routes.ai_routes import ai_bp
    from routes.metrics_routes import metrics_bp
    from routes.wiki_routes import wiki_bp

    result = postgres_db.test_connection()
    if not result.get('success'):
        print(f"[PostgreSQL] 연결 실패: {result.get('error')}")
        return None

    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200MB 업로드 허용
    CORS(app, resources={
        r"/api/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"]
        }
    })
    app.register_blueprint(postgres_bp)
    app.register_blueprint(file_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(wiki_bp)

    db_config = postgres_db.get_db_config()
    print(f"[PostgreSQL] DB: {db_config.get('host')}:{db_config.get('port')}/{db_config.get('database')}")
    return app


def run_app(app, name, port):
    """Flask 앱 실행 (개발 모드: Flask dev server 사용)"""
    print(f"[{name}] Flask 개발 서버: http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, threaded=True, use_reloader=False)


def main():
    print("=" * 50)
    print("Haniwon Unified Server - 개발 모드 (WSL)")
    print("=" * 50)
    print()

    mssql_port = config.get("mssql_api_port", 3100)
    postgres_port = config.get("postgres_api_port", 3200)

    # Flask 앱 생성
    mssql_app = create_mssql_app()
    postgres_app = create_postgres_app()

    # MSSQL 서버 (백그라운드 스레드)
    if mssql_app:
        t = threading.Thread(target=run_app, args=(mssql_app, "MSSQL", mssql_port), daemon=True)
        t.start()
        time.sleep(1)

    # PostgreSQL 서버 (메인 스레드)
    if postgres_app:
        run_app(postgres_app, "PostgreSQL", postgres_port)
    else:
        print("[PostgreSQL] 앱 생성 실패. MSSQL만 실행합니다.")
        if mssql_app:
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n서버 종료")


if __name__ == "__main__":
    main()
