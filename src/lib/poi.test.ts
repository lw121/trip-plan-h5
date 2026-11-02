import { describe, expect, it } from 'vitest'
import { parsePoiList } from './poi'

describe('parsePoiList', () => {
  it('prefers the entrance coordinate and builds a readable address', () => {
    const hits = parsePoiList({
      poiList: {
        pois: [
          {
            id: 'B1',
            name: ' 西湖 ',
            address: '龙井路1号',
            pname: '浙江省',
            cityname: '杭州市',
            adname: '西湖区',
            location: { lng: 120.1, lat: 30.2 },
            entr_location: { lng: 120.14, lat: 30.24 },
          },
          { id: 'B2', name: '没有坐标' },
        ],
      },
    })
    expect(hits).toEqual([
      {
        poiId: 'B1',
        name: '西湖',
        address: '浙江省杭州市西湖区龙井路1号',
        lng: 120.14,
        lat: 30.24,
        city: '杭州市',
      },
    ])
  })
})
