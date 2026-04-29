import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../domain/user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  async create(input: { email: string; passwordHash: string }): Promise<User> {
    const user = this.repo.create({
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      isActive: true,
    });
    return this.repo.save(user);
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.repo.update({ id }, { isActive });
  }
}
