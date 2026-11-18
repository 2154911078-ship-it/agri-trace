package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "11 仓储")
@RestController
@RequestMapping("/api")
public class StorageController {
  private final StorageService storage;

  public StorageController(StorageService storage) {
    this.storage = storage;
  }

  @GetMapping("/warehouses")
  public Map<String, Object> warehouses() {
    return Common.ok(storage.warehouses());
  }

  @GetMapping("/storage/inventory")
  public Map<String, Object> inventory(@RequestParam(required = false) Long farmId) {
    return Common.ok(storage.inventory(farmId));
  }

  @GetMapping("/storage/ledger")
  public Map<String, Object> ledger(
      @RequestParam(required = false) String type,
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(storage.ledger(type, kw, farmId, page, size));
  }

  @PostMapping("/storage/inbound")
  public Map<String, Object> inbound(@RequestBody Map<String, Object> body) {
    return Common.ok(storage.inbound(body));
  }

  @PostMapping("/storage/outbound")
  public Map<String, Object> outbound(@RequestBody Map<String, Object> body) {
    return Common.ok(storage.outbound(body));
  }

  @PostMapping("/storage/temperature")
  public Map<String, Object> temperature(@RequestBody Map<String, Object> body) {
    return Common.ok(storage.recordTemperature(body));
  }
}
