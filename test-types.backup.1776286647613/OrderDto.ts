import { OrderItemDto } from './OrderItemDto';

export interface OrderDto {
  orderId?: number;
  amount?: number;
  status?: string;
  orderDate?: string;
  items?: OrderItemDto[];
}
