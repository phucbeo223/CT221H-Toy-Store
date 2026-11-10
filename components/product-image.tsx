'use client';
import {useState} from 'react';
import ToyArt from './toy-art';
import type {Product} from '@/lib/toyjoy';
export default function ProductImage({product,eager=false}:{product:Pick<Product,'name'|'art'|'image_url'|'image_alt'>;eager?:boolean}){
 const [failed,setFailed]=useState<string|null>(null);
 if(!product.image_url||failed===product.image_url)return <ToyArt kind={product.art}/>;
 return <img className="product-photo" src={product.image_url} alt={product.image_alt||product.name} loading={eager?'eager':'lazy'} decoding="async" width={720} height={720} onError={()=>setFailed(product.image_url||null)}/>;
}
