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

@Tag(name = "08 物流")
@RestController
@RequestMapping("/api/shipments")
public class ShipmentController {
  private final ShipService ships;

  public ShipmentController(ShipService ships) {
    this.ships = ships;
  }

  @GetMapping
  public Map<String, Object> page(
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(ships.page(kw, status, farmId, page, size));
  }

  @PostMapping
  public Map<String, Object> create(@RequestBody Map<String, Object> body) {
    return Common.ok(ships.create(body));
  }

  @PostMapping("/{id}/sign")
  public Map<String, Object> sign(@PathVariable long id, @RequestBody(required = false) Map<String, Object> body) {
    return Common.ok(ships.sign(id, body == null ? null : Common.str(body.get("by"))));
  }
}
