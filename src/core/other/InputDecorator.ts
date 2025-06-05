import { BaseNode, createPostConstructDecorator } from "../NodeConstructor";
import { Message } from "../NodeGenerator";
import { InputService, InputConfig } from "./service/InputService";

class OnInputConfig{

}

const onInput = createPostConstructDecorator<OnInputConfig>('onInput')
    // initialize the default decorator with one parameter containing nothing.
    .withDefaultConfig({})

    // validate that we have at lease 1 parameter for this decorator.
    .withValidator((target, propertyKey, descriptor) => {
        const method = descriptor.value;
        
        // Ensure at least one parameter
        if (method.length === 0) {
            throw new Error(
                `Method must accept at least one parameter (message: {[key:string]: any}).`
            );
        }
        
        // Check parameter types via metadata if available
        const paramTypes = Reflect.getMetadata?.('design:paramtypes', target, propertyKey);
        if (paramTypes && paramTypes[0] !== Object) {
            console.warn(
                `First parameter should be of type {[key:string]: any} (object), but got ${paramTypes[0]?.name || 'unknown'}.`
            );
        }
    })

    // business logic to initialize the function and wire it to the input service.
    .withInitLogic((instance, propertyKey, onInputConfig:OnInputConfig) => {
        //console.log(`Registering onInput callback`,  "PROPERTYKEY", propertyKey, "WEBHOOK CONFIG", onInputConfig, "THIS", this);

        let node = instance as BaseNode<InputConfig>;
        let nodeConfig = node.config();
        let onInputFunction = instance[propertyKey];

        InputService.create(instance, nodeConfig, (message, errorHandler) => {
            try{
                let result = onInputFunction.apply(node, [message, errorHandler]);
                if(result instanceof Promise){
                    result.catch((error:any) => errorHandler(error));
                }
            }
            catch(error){
                errorHandler(error);
            }
        });
    })
    .build();

export {
    onInput
}
