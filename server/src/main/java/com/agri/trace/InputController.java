package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "12 农资")
@RestController
@RequestMapping("/api/inputs")
public class InputController {
  private final InputService inputs;

  public InputController(InputService inputs) {
    this.inputs = inputs;
  }

  @GetMapping
  public Map<String, Object> items() {
    return Common.ok(inputs.items());
  }

  @GetMapping("/ledger")
  public Map<String, Object> ledger(
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(inputs.ledger(kw, farmId, page, size));
  }

  @PostMapping("/purchase")
  public Map<String, Object> purchase(@RequestBody Map<String, Object> body) {
    return Common.ok(inputs.purchase(body));
  }

  @PostMapping("/use")
  public Map<String, Object> use(@RequestBody Map<String, Object> body) {
    return Common.ok(inputs.use(body));
  }
}
