import os
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

_engine: Optional[Engine] = None


def get_master_engine() -> Engine:
    """Singleton engine para o banco master (varzeaprime_config)."""
    global _engine
    if _engine is not None:
        return _engine

    url = os.environ.get("MASTER_DB_URL")
    if not url:
        raise RuntimeError("MASTER_DB_URL não definido")

    # pool_pre_ping evita conexões mortas; pool_recycle evita timeout em MySQL
    _engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=1800,
        future=True,
    )
    return _engine


def fetch_all(sql: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    eng = get_master_engine()
    with eng.connect() as conn:
        result = conn.execute(text(sql), params or {})
        cols = list(result.keys())
        return [dict(zip(cols, row)) for row in result.fetchall()]


def fetch_one(sql: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    eng = get_master_engine()
    with eng.connect() as conn:
        row = conn.execute(text(sql), params or {}).mappings().first()
        return dict(row) if row else None


def safe_db_error(err: Exception) -> str:
    # Mensagem curta e segura para retornar ao client
    if isinstance(err, SQLAlchemyError):
        return "Erro de banco de dados"
    return "Erro interno"
