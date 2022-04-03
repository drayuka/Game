

declare const Circle : Circle;
declare const Square: Square;

type Circle = "circle";
type Square = "square";

type Shape = Circle | Square;

type ShapeType<T> = 
    T extends Circle ? CircleClass :
    T extends Square ? SquareClass : never;

abstract class ShapeClass {
    type: Shape;
    getIfShape<T extends Shape>(type: T) : ShapeType<T> | undefined {
        if(type == this.type) {
            return this as ShapeType<T>;
        }
        return;
    }
}

class CircleClass extends ShapeClass {
    radius: number;
}

class SquareClass extends ShapeClass {
    length: number;
}
