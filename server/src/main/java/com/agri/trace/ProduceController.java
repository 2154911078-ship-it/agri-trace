package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "05 生产")
@RestController
@RequestMapping("/api/produce")
public class ProduceController {
  private final ProduceService produce;

  public ProduceController(ProduceService produce) {
    this.produce = produce;
  }

  @GetMapping("/records")
  public Map<String, Object> page(
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) String type,
      @RequestParam(required = false) Long batchId,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(produce.page(kw, type, batchId, farmId, page, size));
  }

  @PostMapping("/records")
  public Map<String, Object> create(@RequestBody Map<String, Object> body) {
    return Common.ok(produce.create(body));
  }
}
