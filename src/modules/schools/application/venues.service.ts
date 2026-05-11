import { Injectable } from '@nestjs/common';
import { NotFoundError, ConflictError } from '@common/errors/domain.errors';
import { VenuesRepository } from '../infrastructure/venues.repository';

@Injectable()
export class VenuesService {
  constructor(private readonly venuesRepository: VenuesRepository) {}

  async list(schoolId: string) {
    return this.venuesRepository.findAll(schoolId);
  }

  async getById(schoolId: string, id: string) {
    const venue = await this.venuesRepository.findById(id, schoolId);
    if (!venue) throw new NotFoundError('Venue not found');
    return venue;
  }

  async create(schoolId: string, dto: { name: string; latitude?: number; longitude?: number }) {
    const existing = await this.venuesRepository.findByName(dto.name, schoolId);
    if (existing) throw new ConflictError('Venue name already exists in this school');

    try {
      return await this.venuesRepository.create(schoolId, dto);
    } catch (e: any) {
      throw e;
    }
  }

  async update(schoolId: string, id: string, dto: { name?: string; latitude?: number; longitude?: number }) {
    const venue = await this.venuesRepository.update(id, schoolId, dto);
    if (!venue) throw new NotFoundError('Venue not found');
    return venue;
  }

  async delete(schoolId: string, id: string) {
    const deleted = await this.venuesRepository.delete(id, schoolId);
    if (!deleted) throw new NotFoundError('Venue not found');
    return { success: true };
  }
}