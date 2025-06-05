class JsonUtil {
    public static jsonUpdate(source:{[key:string]:any}, location:string, newValue:any):any{
        let pointer = source;
        let keys = location.split(".");
        while(keys.length>1){
            let key = keys.shift()!;
            if(!pointer[key]){
                pointer[key] = {};
            }
            pointer = pointer[key];
        }
        pointer[keys.shift()!] = newValue;
        return source;
    }
}

export {
    JsonUtil
}