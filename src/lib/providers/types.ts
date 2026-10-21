export interface ImageProvider {
  name: string;
  model: string;
  costPerImage: number;
  generate(input: {
    prompt: string;
    productImageUrl: string;
    aspect: "1:1" | "4:5" | "9:16";
  }): Promise<Buffer>;
}
