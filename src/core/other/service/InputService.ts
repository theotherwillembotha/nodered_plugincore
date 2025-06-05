import { BaseNode, BaseNodeConfig, Template } from "../../NodeConstructor";

export class Input{
    constructor(node:BaseNode<BaseNodeConfig>, config:InputConfig, handler:(message:any, errorHandler:(error:any) => void) => void){
        node.node().on("input", function(msg, send, done){
            try{
                handler(msg, done);
            }
            catch(error:any){
                console.log(error);
                done(error);
            }
        })
    }
}

export class InputService {
    private constructor(){}

    static create(node:BaseNode<BaseNodeConfig>, config:InputConfig, handler:(message:any, errorHandler:Function) => void):Input{
        return new Input(node, config, handler);
    }
}

export interface InputConfig extends BaseNodeConfig {
    
}

export abstract class InputHandler {
    public abstract onInput(message:any, errorHandler:Function):void;
}

export class InputTemplate extends Template {

}
  