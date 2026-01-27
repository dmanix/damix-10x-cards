import { describe, it, expect, vi } from "vitest";

/**
 * Example unit test file
 * This demonstrates basic Vitest usage and best practices
 */

describe("Example Unit Tests", () => {
  describe("Basic assertions", () => {
    it("should pass a simple test", () => {
      expect(1 + 1).toBe(2);
    });

    it("should handle strings correctly", () => {
      const greeting = "Hello, World!";
      expect(greeting).toContain("World");
      expect(greeting).toMatch(/Hello/);
    });

    it("should work with objects", () => {
      const user = { name: "John", age: 30 };
      expect(user).toHaveProperty("name");
      expect(user).toEqual({ name: "John", age: 30 });
    });
  });

  describe("Mocking functions", () => {
    it("should mock a function", () => {
      const mockFn = vi.fn((x: number) => x * 2);

      const result = mockFn(5);

      expect(result).toBe(10);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(5);
    });

    it("should spy on existing functions", () => {
      const calculator = {
        add: (a: number, b: number) => a + b,
      };

      const spy = vi.spyOn(calculator, "add");

      calculator.add(2, 3);

      expect(spy).toHaveBeenCalledWith(2, 3);
      expect(spy).toHaveReturnedWith(5);
    });
  });

  describe("Async operations", () => {
    it("should handle promises", async () => {
      const promise = Promise.resolve("success");
      await expect(promise).resolves.toBe("success");
    });

    it("should handle async functions", async () => {
      const fetchData = async () => {
        return { data: "test" };
      };

      const result = await fetchData();
      expect(result).toEqual({ data: "test" });
    });
  });

  describe("Type testing", () => {
    it("should validate types", () => {
      const value = "test";
      expect(typeof value).toBe("string");
    });
  });
});
