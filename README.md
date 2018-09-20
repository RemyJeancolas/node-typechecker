# Node typechecker

[![Build Status](https://travis-ci.org/RemyJeancolas/node-typechecker.svg?branch=master)](https://travis-ci.org/RemyJeancolas/node-typechecker)
[![Coverage Status](https://coveralls.io/repos/github/RemyJeancolas/node-typechecker/badge.svg)](https://coveralls.io/github/RemyJeancolas/node-typechecker)
[![Dependency Status](https://gemnasium.com/badges/github.com/RemyJeancolas/node-typechecker.svg)](https://gemnasium.com/github.com/RemyJeancolas/node-typechecker)
[![Known Vulnerabilities](https://snyk.io/test/github/RemyJeancolas/node-typechecker/badge.svg)](https://snyk.io/test/github/RemyJeancolas/node-typechecker)
[![Latest Stable Version](https://img.shields.io/npm/v/node-typechecker.svg)](https://www.npmjs.com/package/node-typechecker)
[![npm Downloads](https://img.shields.io/npm/dm/node-typechecker.svg)](https://www.npmjs.com/package/node-typechecker)

Utility for Typescript projects that allows to check that an object validates a predefined contract.

## Use in project

### Installation

To install the type checker for use in your project, go to your project's main directory, then run the following command:

```
npm install --production --save node-typechecker
```

### Usage

To use the type checker in your project, follow the snippet below:

#### 1. Configure compiler

The node-typechecker type definitions are included in the npm package.

**Important!** Node typechecker requires TypeScript >= 1.8 and the `experimentalDecorators` and `emitDecoratorMetadata` options in your tsconfig.json file.
```js
{
    "compilerOptions": {
        ... // Other options you need
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    }
}
```

#### 2. Decorate classes

You need to add validation in your classes using the `PropertyCheck` decorator.  
The `PropertyCheck` decorator takes an optional parameter in its constructor, with the following structure:  
```ts
{
    type?: any; // Used to override a property type (if you don't include this parameter, property type will be automatically found)
    required?: boolean; // Tell the validator if the property is required (default to true)
    nullable?: boolean; // Tell the validator if the property can be null or undefined (default false)
    arrayType?: any; // If your property is an array, define the item's type. If you don't want to check the item's type, just omit this parameter (default undefined)
}
```

Let's take an example with an `Article` class:

File Article.ts:
```ts
// Import module
import {PropertyCheck} from 'node-typechecker';
import {Author} from './Author.ts'; // Existing Author class which also contains validation

export class Article {
    // Property title is required and non-nullable (default behavior)
    @PropertyCheck()
    public title: string;
    
    // Property subTitle is not required, but if present it is non-nullable
    @PropertyCheck({required: false})
    public subTitle: string;
    
    // As there is no PropertyCheck decorator, property content will be ignored by the Type checker
    public content: string;
    
    // Property tags is required but its value is non-nullable, if present, tags items will not be checked
    @PropertyCheck({nullable: true})
    public tags: string[];
    
    // Property authors is required, non-nullable, and its children will be checked as Author objects
    // If Author class uses PropertyCheck decorators, nested validation will be performed
    @PropertyCheck({arrayType: Author})
    public authors: Author[];
}
```

#### 3. Validate objects

You can validate objects with 2 different ways: 
1. Manual validation
2. Automatic validation on function call
 
##### Manual validation

To validate an object manually, you can call the `validate` method:

```ts
/**
  * @param input Object to validate
  * @param expectedType Expected type
  * @param arrayType If input is an array, type of its items
  */
validate(input: any, expectedType: any, arrayType?: any): void
```
This method throws a `ValidationError` if validation fails, and returns an instance of the validated object on success.

For example, using the previously created `Article` class:
```ts
import {validate} from 'node-typechecker';
import {Article} from './Article.ts';

const article = new Article();
article.title = 'title';

// In this case, the validate() method will throw a ValidationError because the Article 'tags' property is required
validate(article, Article);

// On success, the validate() method will automatically create a valid instance of Article, for example:
const data: any = {
    title: 'Title',
    content: 'Content',
    tags: [],
    authors: []
};

const result = validate(data, Article);
// 'result' is now a valid instance of Article object
```

##### Automatic validation on function call

You can perform an automatic validation on function call, using the `TypesCheck` and `TypeCheck` decorators.  
The example below shows how to proceed:

```ts
import {TypesCheck, TypeCheck} from 'node-typechecker';
import {Article} from './Article';

@TypesCheck
function saveArticleInDb(@TypeCheck(Article) article: Article): void {
    // If you reach this part, the input object is validated, save the article in database
}

const article = new Article();
article.title = 'title';

// In this case, saveArticleInDb() method will throw the ValidationError
saveArticleInDb(article);
```

In the previous example, as `saveArticleInDb()` method uses the `TypesCheck` and `TypeCheck` decorators, the validatation will be called **before** the function execution, and the `saveArticleInDb()` method will throw a `ValidationError`.  

* The `TypesCheck` decorator is needed to enable validation before function calls, and doesn't take any argument.  
* The `TypeCheck` decorator must be used for each parameter that needs validation, it takes one parameter which is the expected type.
 
## Limitations

As this module uses Typescript decorators which are a recent functionality, there are some limitations in its usage:

* The class properties that can be validated have to be *real* objects (meaning: can be instanciated with the `new ` operator):  
For example, if a class property to validate is an interface or `any`, the nested validation will be ignored (but the `required` and `nullable` validations will still work).

* To validate array items type, you **must** use the `arrayType` parameter. Indeed the `reflect-metadata` package that this modules uses can automatically detect base types, but typed arrays are detected as `Array`.

## Authors

* **Rémy Jeancolas** - *Initial work* - [RemyJeancolas](https://github.com/RemyJeancolas)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.