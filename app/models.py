from sqlalchemy import Column, Integer, String, Float, Text, Boolean, UniqueConstraint
from app.database import Base


class Category(Base):
    __tablename__ = 'categories'

    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String, nullable=False)
    type       = Column(String, nullable=False)   # 'income' | 'expense'
    color_code = Column(String, nullable=True)    # HEX
    sort_order = Column(Integer, nullable=False, default=0)
    is_custom  = Column(Boolean, nullable=False, default=True)


class Account(Base):
    __tablename__ = 'accounts'

    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String, nullable=False)
    initial_balance = Column(Float, nullable=False, default=0.0)


class Plan(Base):
    __tablename__ = 'plans'

    id              = Column(Integer, primary_key=True, autoincrement=True)
    category_id     = Column(Integer, nullable=False)
    week_start_date = Column(String, nullable=False)
    week_end_date   = Column(String, nullable=False)
    amount          = Column(Float, nullable=False, default=0.0)


class Fact(Base):
    __tablename__ = 'facts'

    id              = Column(Integer, primary_key=True, autoincrement=True)
    account_id      = Column(Integer, nullable=False)
    category_id     = Column(Integer, nullable=False)
    week_start_date = Column(String, nullable=False)
    week_end_date   = Column(String, nullable=False)
    amount          = Column(Float, nullable=False, default=0.0)
    date            = Column(String, nullable=True)
    comment         = Column(Text, nullable=True)
    external_id     = Column(String, nullable=True, unique=True)

    __table_args__ = (
        UniqueConstraint('external_id', name='uq_facts_external_id'),
    )


class Transfer(Base):
    __tablename__ = 'transfers'

    id                         = Column(Integer, primary_key=True, autoincrement=True)
    source_transaction_id      = Column(Integer, nullable=False)
    destination_transaction_id = Column(Integer, nullable=False)
    amount                     = Column(Float, nullable=False)
    date                       = Column(String, nullable=False)


class Settings(Base):
    __tablename__ = 'settings'

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    planning_start_date = Column(String, nullable=True)
    financial_strategy  = Column(String, nullable=False, default='manual')
    visual_config       = Column(Text, nullable=True)     # JSON