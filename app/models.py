from sqlalchemy import (
    Column, Integer, String, Float, Text, UniqueConstraint
)
from app.database import Base


class Category(Base):
    __tablename__ = 'categories'

    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String, nullable=False)
    type       = Column(String, nullable=False)   # 'income' | 'expense'
    color_code = Column(String, nullable=True)    # HEX, например '#22c55e'
    sort_order = Column(Integer, nullable=False, default=0)


class Account(Base):
    __tablename__ = 'accounts'

    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String, nullable=False)
    type            = Column(String, nullable=False)  # 'cash'|'deposit'|'credit_card'
    initial_balance = Column(Float, nullable=False, default=0.0)


class Plan(Base):
    __tablename__ = 'plans'

    id              = Column(Integer, primary_key=True, autoincrement=True)
    category_id     = Column(Integer, nullable=False)  # FK → categories.id
    week_start_date = Column(String, nullable=False)   # ISO: '2025-01-06'
    week_end_date   = Column(String, nullable=False)   # ISO: '2025-01-12'
    amount          = Column(Float, nullable=False, default=0.0)


class Fact(Base):
    __tablename__ = 'facts'

    id              = Column(Integer, primary_key=True, autoincrement=True)
    account_id      = Column(Integer, nullable=False)  # FK → accounts.id
    category_id     = Column(Integer, nullable=False)  # FK → categories.id
    week_start_date = Column(String, nullable=False)
    week_end_date   = Column(String, nullable=False)
    amount          = Column(Float, nullable=False, default=0.0)
    date            = Column(String, nullable=True)    # точная дата операции
    comment         = Column(Text, nullable=True)
    external_id     = Column(String, nullable=True, unique=True)

    __table_args__ = (
        UniqueConstraint('external_id', name='uq_facts_external_id'),
    )


class Transfer(Base):
    __tablename__ = 'transfers'

    id                         = Column(Integer, primary_key=True, autoincrement=True)
    source_transaction_id      = Column(Integer, nullable=False)  # FK → facts.id
    destination_transaction_id = Column(Integer, nullable=False)  # FK → facts.id
    amount                     = Column(Float, nullable=False)
    date                       = Column(String, nullable=False)


class Settings(Base):
    __tablename__ = 'settings'

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    planning_start_date = Column(String, nullable=True)
    planning_end_date   = Column(String, nullable=True)
    financial_strategy  = Column(String, nullable=False, default='manual')
    visual_config       = Column(Text, nullable=True)  # JSON строка