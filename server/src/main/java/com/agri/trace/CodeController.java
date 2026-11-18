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

@Tag(name = "07 赋码")
@RestController
@RequestMapping("/api/codes/segments")
public class CodeController {
  private final CodeService codes;

  public CodeController(CodeService codes) {
    this.codes = codes;
  }

  @GetMapping
  public Map<String, Object> page(
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(codes.page(kw, status, farmId, page, size));
  }

  @PostMapping
  public Map<String, Object> generate(@RequestBody Map<String, Object> body) {
    return Common.ok(codes.generate(body));
  }

  @GetMapping("/{id}/codes")
  public Map<String, Object> codes(@PathVariable long id,
      @RequestParam(required = false) Integer limit) {
    return Common.ok(codes.codes(id, limit));
  }

  @PostMapping("/{id}/freeze")
  public Map<String, Object> freeze(@PathVariable long id) {
    return Common.ok(codes.freeze(id, true));
  }

  @PostMapping("/{id}/unfreeze")
  public Map<String, Object> unfreeze(@PathVariable long id) {
    return Common.ok(codes.freeze(id, false));
  }

  @PostMapping("/{id}/activate")
  public Map<String, Object> activate(@PathVariable long id) {
    return Common.ok(codes.activate(id));
  }

  @PostMapping("/{id}/void")
  public Map<String, Object> voidIt(@PathVariable long id) {
    return Common.ok(codes.voidSegment(id));
  }
}
