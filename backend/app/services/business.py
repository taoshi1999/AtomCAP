"""业务对象（companies / deals）存取服务。

设计文档流程二 Step 6-7：项目获取 Agent 分析流落地——
材料解析后创建/关联 Company（客观公司实体），再以当前机构视角创建 Deal（投资机会）。

约定：
- Deal.data 入库前必须经 DealProfile 强校验，绝不落脏数据（与交付对象同等严格）
- Deal 状态流转由系统管控并写 domain_events（约定 4）——本服务只建对象，记账由 runner 编排
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Company, Deal
from app.objects.deal import DealProfile


async def load_known_companies(
    db: AsyncSession, *, institution_id: uuid.UUID, limit: int = 500
) -> list[dict]:
    """加载同机构已有公司（实体对齐用瘦身视图）。

    供 runner 在 run 创建事务中预加载注入子图 state（节点保持纯函数，不碰库）。
    aliases 存在 profile JSONB 里，一并带出供 align_entity 跨字段匹配。
    """
    rows = (
        await db.execute(
            select(Company)
            .where(Company.institution_id == institution_id)
            .limit(limit)
        )
    ).scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "uscc": c.uscc,
            "aliases": (c.profile or {}).get("aliases", []),
        }
        for c in rows
    ]


async def upsert_company(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    extraction: dict,
    matched_company_id: uuid.UUID | None = None,
) -> Company:
    """创建或更新 Company 业务对象（设计文档流程二 Step 6）。

    命中已有公司（align_entity 给出 matched_company_id）则更新其客观信息，否则新建。
    Company 只存客观信息（名称/uscc/官网/创始人/产品等），不存机构视角的研判结论。
    """
    name = (extraction.get("company_name") or "未识别项目").strip()
    uscc = (extraction.get("uscc") or "").strip() or None
    profile_patch = {
        k: v
        for k, v in {
            "aliases": extraction.get("aliases") or [],
            "official_website": extraction.get("official_website"),
            "founders": extraction.get("founders") or [],
            "product": extraction.get("product"),
            "track": extraction.get("track"),
            "sub_direction": extraction.get("sub_direction"),
            "one_line_intro": extraction.get("one_line_intro"),
        }.items()
        if v
    }

    company: Company | None = None
    if matched_company_id is not None:
        company = (
            await db.execute(
                select(Company).where(
                    Company.id == matched_company_id,
                    Company.institution_id == institution_id,
                )
            )
        ).scalar_one_or_none()

    if company is None:
        company = Company(
            institution_id=institution_id,
            name=name,
            uscc=uscc,
            profile=profile_patch,
        )
        db.add(company)
    else:
        # 更新：补全客观字段（已有非空值不被空覆盖），合并 profile
        if uscc and not company.uscc:
            company.uscc = uscc
        merged = dict(company.profile or {})
        merged.update(profile_patch)
        company.profile = merged
    await db.flush()
    return company


async def create_deal(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    company_id: uuid.UUID,
    profile: dict,
) -> Deal:
    """创建 Deal 业务对象（设计文档流程二 Step 7）。data 入库前经 DealProfile 强校验。"""
    validated = DealProfile.model_validate(profile)  # 校验不过直接抛错，绝不落脏数据
    row = Deal(
        institution_id=institution_id,
        company_id=company_id,
        status=validated.status.value,
        data=validated.model_dump(mode="json"),
    )
    db.add(row)
    await db.flush()
    return row
