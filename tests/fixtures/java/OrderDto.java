package com.example.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class OrderDto {
    private Long orderId;
    private BigDecimal amount;
    private String status;
    private LocalDateTime orderDate;
    private List<OrderItemDto> items;
}
