import {TypeCheckProperty, validate} from './TypeChecker';

interface FooBar {
    description: string;
}

class Bar {
    @TypeCheckProperty({required: true})
    public description: string;
    public lastName: string;
}

class Foo {
    @TypeCheckProperty({required: false})
    public name: string;
    @TypeCheckProperty()
    public bar: Bar;
}

const foo = new Foo();
const a: any = {description: 'aaa'};
foo.bar = a;//new Bar();
foo.bar.lastName = 'foobar';
validate(foo, Foo);