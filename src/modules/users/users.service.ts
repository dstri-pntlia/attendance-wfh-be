import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { hashPassword } from '../../common/utils/password.util.js';
import { User, UserRole } from '../../core/database/entities/user.entity.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private repo(manager?: EntityManager): Repository<User> {
    return manager ? manager.getRepository(User) : this.users;
  }

  findById(id: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({ where: { id } });
  }

  findByEmail(email: string, manager?: EntityManager): Promise<User | null> {
    return this.repo(manager).findOne({
      where: { email: normalizeEmail(email) },
    });
  }

  findByEmailWithPasswordHash(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizeEmail(email) })
      .getOne();
  }

  async create(input: CreateUserInput, manager?: EntityManager): Promise<User> {
    const repo = this.repo(manager);
    const user = repo.create({
      email: normalizeEmail(input.email),
      passwordHash: await hashPassword(input.password),
      role: input.role,
    });
    return repo.save(user);
  }

  async setActive(
    id: string,
    isActive: boolean,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update({ id }, { isActive });
  }

  async changePassword(
    id: string,
    newPassword: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update(
      { id },
      { passwordHash: await hashPassword(newPassword) },
    );
  }

  async bumpTokenVersion(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).increment({ id }, 'tokenVersion', 1);
  }

  async changeEmail(
    id: string,
    email: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update({ id }, { email: normalizeEmail(email) });
  }

  async recordLogin(id: string, at: Date = new Date()): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: at });
  }
}
