package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "13 销售订单")
@RestController
@RequestMapping("/api")
public class OrderController {
  private final OrderService orders;

  public OrderController(OrderService orders) {
    this.orders = orders;
  }

  @GetMapping("/customers")
  public Map<String, Object> customers(@RequestParam(required = false) String kw) {
    return Common.ok(orders.customers(kw));
  }

  @PostMapping("/customers")
  public Map<String, Object> createCustomer(@RequestBody Map<String, Object> body) {
    return Common.ok(orders.createCustomer(body));
  }

  @GetMapping("/orders")
  public Map<String, Object> orders(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(orders.orders(status, kw, farmId, page, size));
  }

  @PostMapping("/orders")
  public Map<String, Object> create(@RequestBody Map<String, Object> body) {
    return Common.ok(orders.createOrder(body));
  }

  @PostMapping("/orders/{id}/{action}")
  public Map<String, Object> move(
      @PathVariable long id,
      @PathVariable String action,
      @RequestBody(required = false) Map<String, Object> body) {
    return Common.ok(orders.move(id, action, body));
  }
}
