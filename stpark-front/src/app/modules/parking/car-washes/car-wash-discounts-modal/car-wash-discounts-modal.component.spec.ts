import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CarWashDiscountsModalComponent } from './car-wash-discounts-modal.component';

describe('CarWashDiscountsModalComponent', () => {
  let component: CarWashDiscountsModalComponent;
  let fixture: ComponentFixture<CarWashDiscountsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarWashDiscountsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CarWashDiscountsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
