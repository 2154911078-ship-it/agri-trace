package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "06 质检")
@RestController
@RequestMapping("/api/inspects")
public class InspectController {
  private final InspectService inspects;

  public InspectController(InspectService inspects) {
    this.inspects = inspects;
  }

  @GetMapping
  public Map<String, Object> page(
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) Integer result,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(inspects.page(kw, result, farmId, page, size));
  }

  @PostMapping
  public Map<String, Object> create(@RequestBody Map<String, Object> body) {
    return Common.ok(inspects.create(body));
  }
}
