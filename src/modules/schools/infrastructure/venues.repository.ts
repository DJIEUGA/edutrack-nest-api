import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface VenueRow {
  id: string;
  school_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

@Injectable()
export class VenuesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(schoolId: string): Promise<VenueRow[]> {
    return this.dataSource.query(
      'SELECT id, name, latitude, longitude FROM venues WHERE school_id = $1 ORDER BY name ASC',
      [schoolId],
    );
  }

  async findById(id: string, schoolId: string): Promise<VenueRow | null> {
    const [venue] = await this.dataSource.query(
      'SELECT id, name, latitude, longitude FROM venues WHERE id = $1 AND school_id = $2',
      [id, schoolId],
    );
    return venue || null;
  }

  async findByName(name: string, schoolId: string): Promise<VenueRow | null> {
    const [venue] = await this.dataSource.query(
      'SELECT id, name, latitude, longitude FROM venues WHERE name = $1 AND school_id = $2',
      [name, schoolId],
    );
    return venue || null;
  }

  async create(schoolId: string, data: { name: string; latitude?: number; longitude?: number }): Promise<VenueRow> {
    const [venue] = await this.dataSource.query(
      `INSERT INTO venues (school_id, name, latitude, longitude)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, latitude, longitude`,
      [schoolId, data.name, data.latitude || null, data.longitude || null],
    );
    return venue;
  }

  async update(id: string, schoolId: string, data: Partial<VenueRow>): Promise<VenueRow | null> {
    const [venue] = await this.dataSource.query(
      `UPDATE venues SET 
       name = COALESCE($1, name), 
       latitude = COALESCE($2, latitude), 
       longitude = COALESCE($3, longitude), 
       updated_at = NOW()
       WHERE id = $4 AND school_id = $5
       RETURNING id, name, latitude, longitude`,
      [data.name, data.latitude, data.longitude, id, schoolId],
    );
    return venue || null;
  }

  async delete(id: string, schoolId: string): Promise<boolean> {
    const result = await this.dataSource.query(
      'DELETE FROM venues WHERE id = $1 AND school_id = $2',
      [id, schoolId],
    );
    return result[1] > 0;
  }
}