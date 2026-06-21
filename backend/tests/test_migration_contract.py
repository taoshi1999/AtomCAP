"""迁移-模型契约测试：0001 初始迁移必须与 ORM 完全对应。

不连数据库：用 AST 解析迁移文件中的 op.create_table / op.add_column / sa.Column，
与 Base.metadata 对比表集合与列集合，防止两边漂移。
"""

from __future__ import annotations

import ast
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[1] / "alembic" / "versions"
# 向量维度断言仍只针对建向量列的初始迁移
MIGRATION = VERSIONS_DIR / "0001_initial_schema.py"


def _migration_files() -> list[Path]:
    return sorted(p for p in VERSIONS_DIR.glob("*.py") if p.name[0].isdigit())


def _call_name(node: ast.Call) -> str:
    func = node.func
    if isinstance(func, ast.Attribute):
        return func.attr
    if isinstance(func, ast.Name):
        return func.id
    return ""


def _columns_in(node: ast.AST) -> set[str]:
    """收集任意子树里 sa.Column("name", ...) 的列名。"""
    cols: set[str] = set()
    for sub in ast.walk(node):
        if (
            isinstance(sub, ast.Call)
            and _call_name(sub) == "Column"
            and sub.args
            and isinstance(sub.args[0], ast.Constant)
        ):
            cols.add(sub.args[0].value)
    return cols


def _tables_in_file(path: Path) -> dict[str, set[str]]:
    tree = ast.parse(path.read_text(encoding="utf-8"))

    # 辅助函数（_pk/_tenant/_ts）展开后的公共列（每个迁移文件各自定义）
    helpers: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name.startswith("_"):
            helpers[node.name] = _columns_in(node)

    tables: dict[str, set[str]] = {}
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and _call_name(node) == "create_table"):
            continue
        tname = node.args[0].value
        cols: set[str] = set()
        for arg in node.args[1:]:
            # 直接列、辅助函数调用（_pk()/_tenant()）、星号展开（*_ts()）
            target = arg.value if isinstance(arg, ast.Starred) else arg
            if isinstance(target, ast.Call) and _call_name(target) in helpers:
                cols |= helpers[_call_name(target)]
            else:
                cols |= _columns_in(target)
        tables[tname] = cols

    for node in ast.walk(tree):
        if not (
            isinstance(node, ast.Call)
            and _call_name(node) == "add_column"
            and len(node.args) >= 2
            and isinstance(node.args[0], ast.Constant)
        ):
            continue
        tname = node.args[0].value
        tables.setdefault(tname, set()).update(_columns_in(node.args[1]))
    return tables


def _migration_tables() -> dict[str, set[str]]:
    """聚合 versions/ 下全部迁移文件建的表（增量迁移并集）。"""
    tables: dict[str, set[str]] = {}
    for path in _migration_files():
        for tname, cols in _tables_in_file(path).items():
            tables.setdefault(tname, set()).update(cols)
    return tables


def test_migration_covers_all_orm_tables_and_columns():
    from app.models.models import Base

    mig = _migration_tables()
    orm = {t.name: {c.name for c in t.columns} for t in Base.metadata.sorted_tables}

    missing_tables = set(orm) - set(mig)
    assert not missing_tables, f"迁移缺表: {sorted(missing_tables)}"

    for tname, orm_cols in orm.items():
        missing = orm_cols - mig[tname]
        extra = mig[tname] - orm_cols
        assert not missing, f"迁移中表 {tname} 缺列: {sorted(missing)}"
        assert not extra, f"迁移中表 {tname} 有 ORM 之外的列: {sorted(extra)}"


def test_migration_has_no_orphan_tables():
    from app.models.models import Base

    extra = set(_migration_tables()) - set(Base.metadata.tables)
    assert not extra, f"迁移建了 ORM 之外的表: {sorted(extra)}"


def test_embedding_dim_matches_models():
    from app.models import models as m

    src = MIGRATION.read_text(encoding="utf-8")
    assert f"EMBEDDING_DIM = {m.EMBEDDING_DIM}" in src, "迁移与模型的向量维度不一致"
