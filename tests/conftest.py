import pytest

from src import database


@pytest.fixture(autouse=True)
def temp_db_path(tmp_path, monkeypatch):
    db_path = tmp_path / "applications.db"
    monkeypatch.setattr(database, "DB_PATH", db_path)
    database.init_db()
    return db_path
