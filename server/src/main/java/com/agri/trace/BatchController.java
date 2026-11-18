package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "03 批次")
@RestController
@RequestMapping("/api/batches")
public class BatchController {
  private final BatchService batches;

  public BatchController(BatchService batches) {
    this.batches = batches;
  }

  @GetMapping
  public Map<String, Object> all(@RequestParam(required = false) Long farmId) {
    return Common.ok(batches.all(farmId));
  }

  @GetMapping("/{id}")
  public Map<String, Object> one(@PathVariable long id) {
    return Common.ok(batches.summary(id));
  }
}
