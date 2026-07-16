/**
 * @file public-data.service.spec.ts
 * @path src/app/shared/services/public-data.service.spec.ts
 * @project RPSW Web
 * @description Unit tests for PublicDataService using HttpClientTestingModule.
 */

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PublicDataService } from './public-data.service';
import { environment } from '../../../environments/environment';

describe('PublicDataService', () => {
  let service: PublicDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PublicDataService]
    });

    service = TestBed.inject(PublicDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensures no outstanding HTTP requests remain
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getStorageUrl', () => {
    it('should return an empty string if the path is empty', () => {
      expect(service.getStorageUrl('')).toBe('');
    });

    it('should return the original URL if it starts with http', () => {
      const url = 'https://example.com/image.jpg';
      expect(service.getStorageUrl(url)).toBe(url);
    });

    it('should prepend /storage/ to a local path', () => {
      expect(service.getStorageUrl('my-image.png')).toBe('/storage/my-image.png');
    });
  });

  describe('getShopStatus', () => {
    it('should make a GET request to the correct endpoint with cache headers', () => {
      const mockResponse = { is_shop_active: true };

      service.getShopStatus().subscribe(res => {
        expect(res).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${environment.base_api_url}/shop/public/status`);
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      
      req.flush(mockResponse);
    });
  });
});